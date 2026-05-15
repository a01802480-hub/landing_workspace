'use client';

import { motion, useScroll, useSpring } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Dna, Zap, Shield, Activity, ChevronRight } from 'lucide-react';

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Optimized mouse tracking with throttle
  useEffect(() => {
    let ticking = false;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setMousePosition({ x: e.clientX, y: e.clientY });
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Scroll-based progress bar
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <div ref={containerRef} className="min-h-screen bg-white overflow-x-hidden">
      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-[#5B50D6] origin-left z-50"
        style={{ scaleX }}
      />

      {/* Mouse-following gradient blob - optimized */}
      <motion.div
        className="fixed pointer-events-none z-0"
        animate={{
          x: mousePosition.x - 400,
          y: mousePosition.y - 400,
        }}
        transition={{
          type: 'spring',
          stiffness: 30,
          damping: 20,
          mass: 1,
        }}
      >
        <div className="w-[800px] h-[800px] rounded-full bg-[#5B50D6]/5 blur-[100px]" />
      </motion.div>

      {/* Hero Section */}
      <HeroSection />

      {/* Marquee Section */}
      <MarqueeSection />

      {/* Bento Grid */}
      <BentoGrid />

      {/* Developer Console */}
      <DeveloperConsole />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </div>
  );
}

// Hero Section - Simplified animation
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 px-6 lg:px-24">
      <div className="max-w-6xl mx-auto text-center relative z-10">
        {/* Headline - simplified staggered reveal */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-5xl md:text-7xl font-bold text-[#2D266F] leading-tight mb-6"
          style={{ letterSpacing: '0.05em' }}
        >
          Precision Engineering for Structural Biology.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-10 leading-relaxed"
        >
          Automate sequence alignment and quantify protein backbone writhe with speed and scientific rigor.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <Link href="/signin">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-10 py-4 bg-[#5B50D6] text-white rounded-lg font-semibold text-lg inline-flex items-center gap-2 hover:bg-[#4a42b8] transition-all shadow-lg shadow-[#5B50D6]/20"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

// Marquee Section - Optimized
function MarqueeSection() {
  const technologies = [
    'FastAPI',
    'React',
    'Next.js',
    'AlphaMissense',
    'SIFT',
    'PDB',
    'BioStream API',
    'ClustalW',
    'MUSCLE',
    'MAFFT',
  ];

  return (
    <section className="py-16 bg-[#F8F9FC] overflow-hidden">
      <div className="relative">
        {/* Fade masks */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#F8F9FC] to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#F8F9FC] to-transparent z-10" />

        <motion.div
          className="flex gap-16 whitespace-nowrap"
          animate={{ x: [0, -1000] }}
          transition={{
            repeat: Infinity,
            duration: 40,
            ease: 'linear',
          }}
        >
          {[...technologies, ...technologies].map((tech, index) => (
            <span
              key={index}
              className="text-2xl font-semibold text-[#2D266F]/30 tracking-wider uppercase"
            >
              {tech}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// Bento Grid - Simplified animations
function BentoGrid() {
  return (
    <section className="py-24 px-6 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 - Large */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="md:col-span-2 bg-[#F8F9FC] rounded-2xl p-8 shadow-sm hover:shadow-xl transition-shadow"
          >
            <div className="mb-6">
              <Activity className="w-12 h-12 text-[#5B50D6] mb-4" />
              <h3 className="text-2xl font-bold text-[#2D266F] mb-3 tracking-wide">
                Structural Quantification
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Discrete Frenet-Serret modeling for $Wr$ calculation. Advanced mathematical
                frameworks for precise protein structure analysis.
              </p>
            </div>
            <div className="h-48 bg-gradient-to-br from-[#5B50D6]/10 to-[#F0EFFF] rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 400 200" className="w-full h-full">
                <path
                  d="M 20 100 Q 100 20, 200 100 T 380 100"
                  fill="none"
                  stroke="#5B50D6"
                  strokeWidth="2"
                />
                <circle cx="200" cy="100" r="8" fill="#5B50D6" />
              </svg>
            </div>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-[#F8F9FC] rounded-2xl p-8 shadow-sm hover:shadow-xl transition-shadow"
          >
            <Zap className="w-12 h-12 text-[#5B50D6] mb-4" />
            <h3 className="text-xl font-bold text-[#2D266F] mb-3 tracking-wide">
              Evolutionary Logic
            </h3>
            <p className="text-gray-600 mb-6 text-sm">
              Interactive SIFT score analysis with real-time visualization.
            </p>
            <div className="space-y-4">
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                defaultValue="0.25"
                className="w-full accent-[#5B50D6]"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0.05</span>
                <span className="font-semibold text-[#5B50D6]">0.25</span>
                <span>0.5</span>
              </div>
            </div>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-[#F8F9FC] rounded-2xl p-8 shadow-sm hover:shadow-xl transition-shadow"
          >
            <Shield className="w-12 h-12 text-[#5B50D6] mb-4" />
            <h3 className="text-xl font-bold text-[#2D266F] mb-3 tracking-wide">
              Comparative Genomics
            </h3>
            <p className="text-gray-600 mb-6 text-sm">
              Cross-species protein comparison with evolutionary insights.
            </p>
            <div className="h-32 bg-white rounded-lg p-4">
              <div className="flex items-end justify-between h-full gap-2">
                {[40, 65, 45, 80, 55, 70, 60].map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-[#5B50D6]/20 rounded-t"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Card 4 - Wide */}
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="md:col-span-2 bg-[#F8F9FC] rounded-2xl p-8 shadow-sm hover:shadow-xl transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <Dna className="w-12 h-12 text-[#5B50D6] mb-4" />
                <h3 className="text-2xl font-bold text-[#2D266F] mb-3 tracking-wide">
                  Multi-Sequence Alignment
                </h3>
                <p className="text-gray-600 max-w-md">
                  Industry-leading algorithms for accurate sequence comparison and evolutionary
                  analysis.
                </p>
              </div>
              <ChevronRight className="w-8 h-8 text-[#5B50D6]/30" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// Developer Console - Simplified
function DeveloperConsole() {
  const consoleLines = [
    '> Initializing BioStream API...',
    '> Loading AlphaMissense model...',
    '> Connecting to PDB database...',
    '> Running SIFT predictions...',
    '> Calculating backbone writhe...',
    '> Alignment complete: 98.7% accuracy',
    '> Results exported successfully',
  ];

  return (
    <section className="py-24 px-6 lg:px-24">
      <div className="max-w-5xl mx-auto">
        <div className="bg-slate-950 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="ml-4 text-sm text-gray-400 font-mono">biostream-console</span>
          </div>
          <div className="font-mono text-sm space-y-2">
            {consoleLines.map((line, index) => (
              <div key={index} className="text-green-400">
                {line}
              </div>
            ))}
            <div className="text-green-400 animate-pulse">_</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// CTA Section
function CTASection() {
  return (
    <section className="py-24 px-6 lg:px-24 bg-[#F8F9FC]">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-[#2D266F] mb-6 tracking-wide">
          Ready to Transform Your Research?
        </h2>
        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
          Join thousands of scientists using BioStream for precision protein analysis and
          sequence alignment.
        </p>
        <Link href="/signin">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-10 py-4 bg-[#5B50D6] text-white rounded-lg font-semibold text-lg inline-flex items-center gap-2 hover:bg-[#4a42b8] transition-all shadow-lg shadow-[#5B50D6]/20"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </Link>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-16 px-6 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#5B50D6] rounded-lg flex items-center justify-center">
                <Dna className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-[#2D266F]">BioStream</span>
            </div>
            <p className="text-gray-600 text-sm">
              Precision engineering for structural biology and protein analysis.
            </p>
          </div>

          {[
            {
              title: 'Product',
              links: ['Features', 'Pricing', 'Documentation', 'API'],
            },
            {
              title: 'Company',
              links: ['About', 'Blog', 'Careers', 'Contact'],
            },
            {
              title: 'Legal',
              links: ['Privacy', 'Terms', 'Security'],
            },
          ].map((section) => (
            <div key={section.title}>
              <h4 className="font-semibold text-[#2D266F] mb-4 tracking-wide">{section.title}</h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-gray-600 hover:text-[#5B50D6] transition-colors text-sm"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            © 2024 BioStream. All rights reserved.
          </p>
          <div className="flex gap-6">
            {['Twitter', 'GitHub', 'LinkedIn'].map((social) => (
              <a
                key={social}
                href="#"
                className="text-gray-500 hover:text-[#5B50D6] transition-colors text-sm"
              >
                {social}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}