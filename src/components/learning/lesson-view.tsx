"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  BookOpen,
  MessageCircle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Fullscreen,
  Minimize,
  ThumbsUp,
  Reply,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { cn, formatClockTime } from "@/lib/utils";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  user: { id: string; username: string; avatar: string | null };
  replies: Comment[];
}

interface MediaResponse {
  kind: "video" | "pdf" | null;
  url: string | null;
  expiresAt: string | null;
}

interface LessonViewProps {
  courseId: string;
  lesson: {
    id: string;
    title: string;
    /** Persisted type — authoritative for rendering. */
    type: "VIDEO" | "READING";
    /** READING lessons with a PDF content source. */
    hasPdf: boolean;
    article: string | null;
    videoDuration: number | null;
    position: number;
    modulePosition: number;
    isFree: boolean;
  };
  initiallyCompleted: boolean;
  allLessons: {
    id: string;
    title: string;
    isFree: boolean;
    videoDuration: number | null;
    modulePosition: number;
    position: number;
  }[];
}

export function LessonView({
  courseId,
  lesson,
  initiallyCompleted,
  allLessons,
}: LessonViewProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [toggling, setToggling] = useState(false);
  const [tab, setTab] = useState<"notes" | "comments">("notes");
  const [notes, setNotes] = useState("");
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoState, setVideoState] = useState({
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    fullscreen: false,
  });

  const commentsQuery = useQuery({
    queryKey: ["comments", lesson.id],
    queryFn: () =>
      apiFetch<{ comments: Comment[] }>(`/api/comments?lessonId=${lesson.id}`),
  });

  // Private media: a short-lived signed URL is minted per playback/viewing
  // session. The raw storage reference never reaches the browser.
  const needsVideo = lesson.type === "VIDEO";
  const needsPdf = lesson.type === "READING" && lesson.hasPdf;
  const mediaQuery = useQuery({
    queryKey: ["lesson-media", courseId, lesson.id, needsPdf ? "pdf" : "video"],
    queryFn: () => apiFetch<MediaResponse>(`/api/learning/${courseId}/lessons/${lesson.id}/media?${needsPdf ? "kind=pdf" : "kind=video"}`),
    enabled: needsVideo || needsPdf,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const mediaUrl = mediaQuery.data?.url ?? null;

  const toggleComplete = async () => {
    setToggling(true);
    try {
      const data = await apiFetch<{ completed: boolean }>(
        `/api/learning/${courseId}/complete/${lesson.id}`,
        { method: "POST" },
      );
      setCompleted(data.completed);
      router.refresh();
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Something went wrong",
        "error",
      );
    } finally {
      setToggling(false);
    }
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await apiFetch("/api/comments", {
        method: "POST",
        body: JSON.stringify({ lessonId: lesson.id, content: comment }),
      });
      setComment("");
      void qc.invalidateQueries({ queryKey: ["comments", lesson.id] });
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Something went wrong",
        "error",
      );
    } finally {
      setPosting(false);
    }
  };

  const updateCommentInCache = (
    comments: Comment[],
    id: string,
    patch: Partial<Comment>,
  ): Comment[] =>
    comments.map((c) =>
      c.id === id
        ? { ...c, ...patch }
        : { ...c, replies: updateCommentInCache(c.replies, id, patch) },
    );

  const toggleLike = async (commentId: string) => {
    try {
      const res = await apiFetch<{ liked: boolean; likeCount: number }>(
        `/api/comments/${commentId}/like`,
        { method: "POST" },
      );
      qc.setQueryData<{ comments: Comment[] }>(
        ["comments", lesson.id],
        (old) =>
          old
            ? {
                ...old,
                comments: updateCommentInCache(old.comments, commentId, {
                  liked: res.liked,
                  likeCount: res.likeCount,
                }),
              }
            : old,
      );
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Something went wrong",
        "error",
      );
    }
  };

  const postReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    setPostingReply(true);
    try {
      await apiFetch("/api/comments", {
        method: "POST",
        body: JSON.stringify({
          lessonId: lesson.id,
          content: replyText,
          parentId,
        }),
      });
      setReplyText("");
      setReplyTo(null);
      void qc.invalidateQueries({ queryKey: ["comments", lesson.id] });
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Something went wrong",
        "error",
      );
    } finally {
      setPostingReply(false);
    }
  };

  const currentIdx = allLessons.findIndex((l) => l.id === lesson.id);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson =
    currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  const video = videoRef.current;

  // Video state sync effect
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handleTimeUpdate = () =>
      setVideoState((s) => ({ ...s, currentTime: v.currentTime }));
    const handleDurationChange = () =>
      setVideoState((s) => ({ ...s, duration: v.duration || 0 }));
    const handlePlay = () => setVideoState((s) => ({ ...s, playing: true }));
    const handlePause = () => setVideoState((s) => ({ ...s, playing: false }));
    const handleEnded = () => setVideoState((s) => ({ ...s, playing: false }));

    v.addEventListener("timeupdate", handleTimeUpdate);
    v.addEventListener("durationchange", handleDurationChange);
    v.addEventListener("play", handlePlay);
    v.addEventListener("pause", handlePause);
    v.addEventListener("ended", handleEnded);
    return () => {
      v.removeEventListener("timeupdate", handleTimeUpdate);
      v.removeEventListener("durationchange", handleDurationChange);
      v.removeEventListener("play", handlePlay);
      v.removeEventListener("pause", handlePause);
      v.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (videoState.playing) v.pause();
    else v.play();
  };

  const formatTime = (seconds: number) => formatClockTime(seconds);

  const comments = commentsQuery.data?.comments ?? [];

  return (
    <div className="space-y-6">
      {/* Media area: rendered strictly by persisted lesson type */}
      <div className="relative rounded-2xl overflow-hidden bg-linear-to-br from-indigo-950 to-violet-950 border border-border aspect-video group">
        {lesson.type === "VIDEO" && mediaUrl ? (
          <>
            <video
              ref={videoRef}
              src={mediaUrl}
              preload="metadata"
              playsInline
              className="absolute inset-0 w-full h-full object-contain"
              onClick={togglePlay}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={togglePlay}
                className="w-20 h-20 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform"
                aria-label={videoState.playing ? "Pause" : "Play"}
              >
                {videoState.playing ? (
                  <Pause className="text-white text-5xl" />
                ) : (
                  <Play className="text-white text-5xl ml-2" />
                )}
              </button>
            </div>

            {/* Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-primary transition-colors p-1"
                  aria-label={videoState.playing ? "Pause" : "Play"}
                >
                  {videoState.playing ? (
                    <Pause size={20} />
                  ) : (
                    <Play size={20} />
                  )}
                </button>

                <div
                  className="flex-1 h-1.5 bg-white/25 rounded-full cursor-pointer relative"
                  onClick={(e) => {
                    if (!video) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const percent =
                      (e.nativeEvent.clientX - rect.left) / rect.width;
                    video.currentTime = percent * (video.duration || 0);
                  }}
                >
                  <div
                    className="absolute left-0 top-0 h-full bg-primary rounded-full"
                    style={{
                      width: `${
                        videoState.duration > 0
                          ? (videoState.currentTime / videoState.duration) * 100
                          : 0
                      }%`,
                    }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow"
                    style={{
                      left: `${
                        videoState.duration > 0
                          ? (videoState.currentTime / videoState.duration) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <span className="text-white text-xs font-mono w-20 text-right">
                  {formatTime(videoState.currentTime)} /{" "}
                  {formatTime(
                    videoState.duration || (lesson.videoDuration ?? 0),
                  )}
                </span>

                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={() => {
                      const v = videoRef.current;
                      if (!v) return;
                      v.muted = !v.muted;
                      setVideoState((s) => ({ ...s, muted: v.muted }));
                    }}
                    className="text-white hover:text-primary transition-colors p-1"
                    aria-label={videoState.muted ? "Unmute" : "Mute"}
                  >
                    {videoState.muted ? (
                      <VolumeX size={18} />
                    ) : (
                      <Volume2 size={18} />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={videoState.volume}
                    onChange={(e) => {
                      const v = videoRef.current;
                      if (!v) return;
                      const vol = Number(e.target.value);
                      v.volume = vol;
                      setVideoState((s) => ({
                        ...s,
                        volume: vol,
                        muted: vol === 0,
                      }));
                    }}
                    className="w-20 h-1.5 bg-white/25 rounded-full appearance-none cursor-pointer accent-white"
                  />
                  <button
                    onClick={() => {
                      const v = videoRef.current;
                      if (!v) return;
                      if (!videoState.fullscreen) {
                        v.requestFullscreen?.();
                        setVideoState((s) => ({ ...s, fullscreen: true }));
                      } else {
                        document.exitFullscreen?.();
                        setVideoState((s) => ({ ...s, fullscreen: false }));
                      }
                    }}
                    className="text-white hover:text-primary transition-colors p-1"
                    aria-label={
                      videoState.fullscreen ? "Exit fullscreen" : "Fullscreen"
                    }
                  >
                    {videoState.fullscreen ? (
                      <Minimize size={18} />
                    ) : (
                      <Fullscreen size={18} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : lesson.type === "READING" && lesson.hasPdf ? (
          /* READING + PDF: embedded viewer over a short-lived signed URL */
          <div className="absolute inset-0 bg-white">
            {mediaUrl ? (
              <iframe
                src={mediaUrl}
                title={`${lesson.title} (PDF)`}
                className="h-full w-full"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-600">
                {mediaQuery.isLoading ? (
                  <>
                    <Spinner className="size-6" />
                    <p className="text-sm">Preparing document…</p>
                  </>
                ) : (
                  <>
                    <FileText className="size-10" />
                    <p className="text-sm font-medium">
                      Document is not available right now.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Poster: video still processing, or reading header */}
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
              {lesson.type === "VIDEO" ? (
                <>
                  <Spinner className="size-8 text-white mb-3" />
                  <p className="text-white/80 text-sm font-semibold">
                    Video is being processed. Check back shortly.
                  </p>
                </>
              ) : (
                <>
                  <div className="h-14 w-14 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-3 shadow-xl">
                    <BookOpen className="h-7 w-7 text-white" />
                  </div>
                  <p className="text-white/80 text-sm font-semibold">
                    {lesson.title}
                  </p>
                  <p className="text-white/40 text-xs mt-1 font-mono">
                    Reading
                  </p>
                </>
              )}
            </div>
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-5 py-4">
              <div className="flex items-center justify-between text-xs text-white/50 font-mono">
                <span>{lesson.type === "READING" ? "READING" : "PROCESSING"}</span>
                <span>
                  {lesson.videoDuration
                    ? formatClockTime(lesson.videoDuration)
                    : "—"}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Toolbar: prev / complete / next */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!prevLesson}
          onClick={
            prevLesson
              ? () =>
                  router.push(`/learning/${courseId}?lesson=${prevLesson.id}`)
              : undefined
          }
          className="gap-1.5"
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>

        <Button
          variant={completed ? "outline" : "default"}
          size="sm"
          onClick={toggleComplete}
          disabled={toggling}
          className="gap-2"
        >
          {toggling ? (
            <Spinner className="size-4" />
          ) : completed ? (
            <>
              <CheckCircle2 className="size-4" />
              Completed
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4" />
              Mark as Complete
            </>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={!nextLesson}
          onClick={
            nextLesson
              ? () =>
                  router.push(`/learning/${courseId}?lesson=${nextLesson.id}`)
              : undefined
          }
          className="gap-1.5"
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Article */}
      {lesson.article && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div
            className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: lesson.article }}
          />
        </div>
      )}

      {/* Notes / Comments */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex gap-4 mb-3">
          {(["notes", "comments"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "text-sm font-medium pb-1 border-b-2 transition-colors capitalize",
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
          {tab === "comments" && (
            <span className="ml-auto text-xs text-muted-foreground font-mono self-end">
              {comments.length} comments
            </span>
          )}
        </div>

        {tab === "notes" ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Take notes while you watch..."
            rows={4}
            className="w-full bg-muted/60 rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none border-0"
          />
        ) : (
          <div className="space-y-3">
            {/* Comment input */}
            <div className="flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void postComment();
                  }
                }}
                placeholder="Add a comment..."
                className="flex-1 bg-muted rounded-xl px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 border-0"
              />
              <button
                onClick={() => void postComment()}
                disabled={posting || !comment.trim()}
                className="bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                aria-label="Post comment"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>

            {commentsQuery.isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner className="size-6" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="size-8 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No comments yet. Be the first to start a discussion!
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    {c.user.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.user.avatar}
                        alt={c.user.username}
                        className="w-8 h-8 rounded-full object-cover flex-none border border-border"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-none text-sm">
                        {c.user.username?.[0]?.toUpperCase() ?? "U"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {c.user.username}
                        </span>
                        <span className="text-xs text-muted-foreground flex-none">
                          {new Date(c.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-wrap mb-2">
                        {c.content}
                      </p>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <button
                          onClick={() => void toggleLike(c.id)}
                          className={cn(
                            "flex items-center gap-1 transition-colors",
                            c.liked
                              ? "text-primary font-semibold"
                              : "hover:text-primary",
                          )}
                        >
                          <ThumbsUp
                            className={cn("size-3", c.liked && "fill-current")}
                          />
                          {c.likeCount}
                        </button>
                        <button
                          onClick={() =>
                            setReplyTo(replyTo === c.id ? null : c.id)
                          }
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          <Reply className="size-3" />
                          Reply
                        </button>
                      </div>

                      {replyTo === c.id && (
                        <div className="mt-2 flex gap-2">
                          <input
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void postReply(c.id);
                              }
                            }}
                            placeholder={`Reply to ${c.user.username}…`}
                            className="flex-1 bg-muted rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 border-0"
                          />
                          <button
                            onClick={() => void postReply(c.id)}
                            disabled={postingReply || !replyText.trim()}
                            className="bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            Reply
                          </button>
                          <button
                            onClick={() => {
                              setReplyTo(null);
                              setReplyText("");
                            }}
                            className="px-2 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {c.replies.length > 0 && (
                        <div className="ml-8 mt-3 space-y-3">
                          {c.replies.map((r) => (
                            <div key={r.id} className="flex gap-3">
                              {r.user.avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={r.user.avatar}
                                  alt={r.user.username}
                                  className="w-6 h-6 rounded-full object-cover flex-none border border-border"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-none text-xs">
                                  {r.user.username?.[0]?.toUpperCase() ?? "U"}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-2 mb-1">
                                  <span className="text-xs font-medium text-foreground">
                                    {r.user.username}
                                  </span>
                                  <span className="text-xs text-muted-foreground flex-none">
                                    {new Date(r.createdAt).toLocaleDateString(
                                      undefined,
                                      {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      },
                                    )}
                                  </span>
                                </div>
                                <p className="text-xs text-foreground whitespace-pre-wrap mb-1">
                                  {r.content}
                                </p>
                                <button
                                  onClick={() => void toggleLike(r.id)}
                                  className={cn(
                                    "flex items-center gap-1 text-xs text-muted-foreground transition-colors",
                                    r.liked
                                      ? "text-primary font-semibold"
                                      : "hover:text-primary",
                                  )}
                                >
                                  <ThumbsUp
                                    className={cn(
                                      "size-3",
                                      r.liked && "fill-current",
                                    )}
                                  />
                                  {r.likeCount}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
