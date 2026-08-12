import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="flex w-full max-w-container-max flex-col gap-16 px-margin-mobile py-12 md:gap-24 md:px-margin-desktop">
      {/* Hero Section */}
      <section className="flex flex-col items-center gap-12 pt-8 md:flex-row">
        <div className="flex-1 space-y-6">
          <h1 className="text-headline-lg-mobile text-on-surface md:text-display-lg">
            Empowering the next generation of <span className="text-primary">professionals.</span>
          </h1>
          <p className="max-w-2xl text-body-lg text-on-surface-variant">
            EduPro is a premium learning platform designed to bridge the gap between academic theory and practical,
            real-world skills. We provide high-utility courses for driven individuals.
          </p>
          <div className="pt-4">
            <a
              href="#story"
              className="inline-flex items-center gap-2 text-label-md text-primary hover:underline"
            >
              Discover our story <span className="material-symbols-outlined text-sm">arrow_downward</span>
            </a>
          </div>
        </div>
        <div className="relative w-full flex-1">
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-outline-variant shadow-sm">
            <img
              className="h-full w-full object-cover"
              alt="A bright, modern corporate training room with large windows letting in natural light. Several professionals are engaged in a collaborative learning session around a sleek wooden table, laptops open."
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCoRMyQBTs739LLlXinO3CqvIC8wVjq8jE_Ahrn2NwYX85NL7h1pX5Pxq-p8YSZ_P6_FfBlO3RPq00PMvRQORQPfhkUIluhZu1eq3KAi21rmHc_IMPpGaAc2E5_s6m1TieQjaK5HmdFYTimVNntEXsWc1j6fKP_oSO9cjBNLaRyMWAsMsWE13QxHEHXiAs0Dd4WuzdepMhAbwfdUCMJ1hdKesKKY06NtEpb0zG_6KF9NT7aZC-zEgpWAA"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent mix-blend-overlay"></div>
          </div>
        </div>
      </section>

      {/* Mission & Values Bento Grid */}
      <section className="scroll-mt-24 space-y-10" id="story">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <h2 className="text-headline-md text-on-surface">Precision in Education</h2>
          <p className="text-body-md text-on-surface-variant">
            Our foundation is built on structural integrity and academic rigor.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Main Value */}
          <div className="flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container-low p-8 transition-colors hover:border-primary/50 md:col-span-2">
            <div className="space-y-4">
              <span
                className="material-symbols-outlined text-4xl text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                architecture
              </span>
              <h3 className="text-title-lg text-on-surface">Structural Integrity</h3>
              <p className="text-body-md text-on-surface-variant">
                We design our curriculum like an architect designs a building: with a solid foundation, clear
                progression paths, and an emphasis on functional utility over trendy ornaments. Every course serves a
                distinct professional purpose.
              </p>
            </div>
          </div>
          {/* Secondary Value 1 */}
          <div className="flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container-low p-8 transition-colors hover:border-primary/50">
            <div className="space-y-4">
              <span
                className="material-symbols-outlined text-4xl text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                psychology
              </span>
              <h3 className="text-title-lg text-on-surface">Cognitive Focus</h3>
              <p className="text-body-md text-on-surface-variant">
                Our platform is designed to reduce cognitive load, allowing the course content to remain the absolute
                focal point of the user experience.
              </p>
            </div>
          </div>
          {/* Secondary Value 2 */}
          <div className="flex flex-col justify-between rounded-xl border border-outline-variant bg-surface-container-low p-8 transition-colors hover:border-primary/50">
            <div className="space-y-4">
              <span
                className="material-symbols-outlined text-4xl text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              <h3 className="text-title-lg text-on-surface">Professional Rigor</h3>
              <p className="text-body-md text-on-surface-variant">
                We partner with industry leaders to ensure every certification carries weight and respect in the
                professional marketplace.
              </p>
            </div>
          </div>
          {/* Secondary Value 3 */}
          <div className="relative flex min-h-[300px] items-end overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low p-8 md:col-span-2">
            <div className="absolute inset-0 z-0">
              <img
                className="h-full w-full object-cover opacity-20"
                alt="Abstract architectural rendering showing clean lines, geometric shapes, and a sense of progression and structural integrity."
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCYhxLORhdnjMf0zK4YFO2Ugt4KxN2tAGrjmTLj2x3Y1el7WTQsHLovI3Jb3MZTZKuF5BNw1D8s02bxpO3gEwEhRc4TdzGxRQB5PdHUOjMeY6k0Micp0Lp6SfIG3nJqqLpZfU9fX5kuZDJPFkSPSSJJ2i2LHTOLYpPT6jnnKbWkOjlihZaqhNkJXSIeY-q55YVH4fyUAlAE5YngOPRsa_gggTjXcx_vkOyvr_o6nvUbdQGtwGjHHf6Hlg"
              />
            </div>
            <div className="relative z-10 max-w-lg space-y-2">
              <h3 className="text-title-lg text-on-surface">Our Story</h3>
              <p className="text-body-md text-on-surface-variant">
                Founded in 2020, EduPro began as an internal training tool for a top-tier consulting firm before
                evolving into a public platform dedicated to elevating professional standards globally.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="space-y-6 rounded-xl border border-outline-variant bg-surface-container-low p-10 text-center md:p-16">
        <h2 className="text-headline-md text-on-surface md:text-headline-lg">Ready to advance your career?</h2>
        <p className="mx-auto max-w-2xl text-body-md text-on-surface-variant">
          Join thousands of professionals who have elevated their skillset through our meticulously designed
          curriculum.
        </p>
        <div className="flex justify-center pt-4">
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-8 py-3 text-label-md text-white transition-colors hover:bg-primary-fixed-variant"
          >
            Browse Courses
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
