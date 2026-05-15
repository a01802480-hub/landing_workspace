'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Dna } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled ? 'bg-white/80 backdrop-blur-xl shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-24 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5B50D6] rounded-lg flex items-center justify-center">
            <Dna className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-[#2D266F] tracking-wide">BioStream</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/docs"
            className="text-sm font-medium text-gray-600 hover:text-[#5B50D6] transition-colors tracking-wide"
          >
            Documentation
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-gray-600 hover:text-[#5B50D6] transition-colors tracking-wide"
          >
            Pricing
          </Link>
          <Link
            href="/about"
            className="text-sm font-medium text-gray-600 hover:text-[#5B50D6] transition-colors tracking-wide"
          >
            About
          </Link>
        </nav>

        <Link
          href="/signin"
          className="px-6 py-2.5 bg-[#5B50D6] text-white rounded-lg hover:bg-[#4a42b8] transition-all font-medium text-sm tracking-wide hover:shadow-lg hover:shadow-[#5B50D6]/25"
        >
          Sign In
        </Link>
      </div>
    </motion.header>
  );
}