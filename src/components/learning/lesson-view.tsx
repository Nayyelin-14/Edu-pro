"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  Lock,
  MessageCircle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Fullscreen,
  Minimize,
  ThumbsUp,
  Reply,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; username: string; avatar: string | null };
  replies: Comment[];
}

interface LessonViewProps {
  courseId: string;
  lesson: {
    id: string;
    title: string;
    videoUrl: string | null;
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
  onMarkComplete?: () => void;
}

export function LessonView({
  courseId,
  lesson,
  initiallyCompleted,
  allLessons,
  onMarkComplete,
}: LessonViewProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [toggling, setToggling] = useState(false);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [showComments, setShowComments] = useState(true);
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

  const toggleComplete = async () => {
    setToggling(true);
    try {
      const data = await apiFetch<{ completed: boolean }>(
        `/api/learning/${courseId}/complete/${lesson.id}`,
        { method: "POST" },
      );
      setCompleted(data.completed);
      if (data.completed && onMarkComplete) onMarkComplete();
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
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
      toast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setPosting(false);
    }
  };

  const currentIdx = allLessons.findIndex((l) => l.id === lesson.id);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

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

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m}:${s.toString().padStart(2, "0")}`;
  };

  const comments = commentsQuery.data?.comments ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Video Player */}
      <div className="relative bg-black aspect-video group">
        {lesson.videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={lesson.videoUrl}
              preload="metadata"
              playsInline
              className="w-full h-full object-contain"
              onClick={togglePlay}
            />
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <button
                onClick={togglePlay}
                className="w-20 h-20 bg-primary/90 rounded-full flex items-center justify-center backdrop-blur-sm shadow-xl hover:scale-105 transition-transform"
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
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-primary transition-colors p-1"
                  aria-label={videoState.playing ? "Pause" : "Play"}
                >
                  {videoState.playing ? <Pause size={24} /> : <Play size={24} />}
                </button>

                <div className="flex-1 h-1.5 bg-white/30 rounded-full cursor-pointer relative" onClick={(e) => {
                  if (!video) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.nativeEvent.clientX - rect.left) / rect.width;
                  video.currentTime = percent * (video.duration || 0);
                }}>
                  <div
                    className="absolute left-0 top-0 h-full bg-primary rounded-full"
                    style={{ width: `${videoState.duration > 0 ? (videoState.currentTime / videoState.duration) * 100 : 0}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow"
                    style={{ left: `${videoState.duration > 0 ? (videoState.currentTime / videoState.duration) * 100 : 0}%` }}
                  />
                </div>

                <span className="text-white text-xs font-mono w-20 text-right">
                  {formatTime(videoState.currentTime)} / {formatTime(videoState.duration || (lesson.videoDuration ?? 0))}
                </span>

                <div className="flex items-center gap-2">
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
                    {videoState.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
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
                      setVideoState((s) => ({ ...s, volume: vol, muted: vol === 0 }));
                    }}
                    className="w-24 h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-primary"
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
                    aria-label={videoState.fullscreen ? "Exit fullscreen" : "Fullscreen"}
                  >
                    {videoState.fullscreen ? <Minimize size={20} /> : <Fullscreen size={20} />}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex size-full items-center justify-center bg-muted">
            <div className="text-center p-8">
              <FileQuestion className="size-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No video available for this lesson.</p>
            </div>
          </div>
        )}
      </div>

      {/* Lesson Content */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12 max-w-4xl mx-auto">
        {/* Lesson Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-border pb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-4">{lesson.title}</h1>
            {lesson.article && (
              <div className="prose max-w-none text-muted-foreground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <div dangerouslySetInnerHTML={{ __html: lesson.article }} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full md:w-auto">
            <Button
              size="lg"
              variant={completed ? "outline" : "default"}
              onClick={toggleComplete}
              disabled={toggling}
              className="w-full md:w-auto flex items-center justify-center gap-2"
            >
              {toggling ? (
                <Spinner className="size-4" />
              ) : completed ? (
                <>
                  <CheckCircle2 className="size-5" />
                  Completed
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-5" />
                  Mark as Complete
                </>
              )}
            </Button>

            <div className="flex gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                size="lg"
                disabled={!prevLesson}
                onClick={prevLesson
                  ? () => router.push(`/learning/${courseId}?lesson=${prevLesson.id}`)
                  : undefined}
                className="flex-1 flex items-center justify-center gap-2"
              >
                <ChevronLeft className="size-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={!nextLesson}
                onClick={nextLesson
                  ? () => router.push(`/learning/${courseId}?lesson=${nextLesson.id}`)
                  : undefined}
                className="flex-1 flex items-center justify-center gap-2"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Discussion Section */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">Discussion</h2>
              <Badge variant="secondary">{comments.length} Comments</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)}>
              <MessageCircle className="size-4" />
              {showComments ? "Hide" : "Show"} Comments
            </Button>
          </div>

          {showComments && (
            <>
              {/* Comment Input */}
              <div className="flex gap-4 mb-10">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-none text-lg">
                  U
                </div>
                <div className="flex-1">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Ask a question or share your thoughts on this lesson..."
                    rows={3}
                    className="border border-border rounded-xl p-4 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <div className="mt-3 flex justify-end">
                    <Button
                      onClick={postComment}
                      disabled={posting || !comment.trim()}
                      size="sm"
                    >
                      {posting ? "Posting…" : "Post Comment"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Comments List */}
              {commentsQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner className="size-8" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No comments yet. Be the first to start a discussion!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-4">
                      {c.user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.user.avatar}
                          alt={c.user.username}
                          className="w-10 h-10 rounded-full object-cover flex-none border border-border"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-none text-lg">
                          {c.user.username?.[0]?.toUpperCase() ?? "U"}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="bg-card border border-border rounded-2xl rounded-tl-none p-5 shadow-sm">
                          <div className="flex items-baseline justify-between mb-2">
                            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                              {c.user.username}
                            </h4>
                            <span className="text-xs text-muted-foreground">
                              {new Date(c.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {c.content}
                          </p>
                          <div className="flex gap-4 mt-3 ml-2">
                            <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                              <ThumbsUp className="size-3.5" /> 0
                            </button>
                            <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                              <Reply className="size-3.5" /> Reply
                            </button>
                          </div>
                        </div>
                        {c.replies.length > 0 && (
                          <div className="ml-10 mt-3 space-y-3">
                            {c.replies.map((r) => (
                              <div key={r.id} className="flex gap-3">
                                {r.user.avatar ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={r.user.avatar}
                                    alt={r.user.username}
                                    className="w-8 h-8 rounded-full object-cover flex-none border border-border"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold flex-none text-sm">
                                    {r.user.username?.[0]?.toUpperCase() ?? "U"}
                                  </div>
                                )}
                                <div className="bg-muted/50 border border-border rounded-2xl rounded-tl-none p-4 flex-1">
                                  <div className="flex items-baseline justify-between mb-1">
                                    <span className="font-medium text-sm text-foreground">
                                      {r.user.username}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                    {r.content}
                                  </p>
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
            </>
          )}
        </section>
      </div>
    </div>
  );
}