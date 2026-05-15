'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Search, Book, Code, Terminal, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function DocsContent() {
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    {
      title: 'Getting Started',
      icon: Book,
      guides: [
        'Introduction to BioStream',
        'Installation & Setup',
        'Quick Start Guide',
        'Authentication',
      ],
    },
    {
      title: 'API Reference',
      icon: Code,
      guides: [
        'REST API Overview',
        'Authentication Endpoints',
        'Sequence Analysis API',
        'Alignment Algorithms',
      ],
    },
    {
      title: 'Examples',
      icon: Terminal,
      guides: [
        'Basic Sequence Upload',
        'Running Alignments',
        'Exporting Results',
        'Advanced Workflows',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white pt-24 pb-16 px-6 lg:px-24">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold text-[#2D266F] mb-4 tracking-wide">Documentation</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to know about using BioStream for protein analysis and sequence alignment.
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="max-w-2xl mx-auto mb-16"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[#F8F9FC] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B50D6] focus:border-transparent"
            />
          </div>
        </motion.div>

        {/* Categories */}
        <div className="grid md:grid-cols-3 gap-8">
          {categories.map((category, index) => (
            <motion.div
              key={category.title}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.6 }}
              className="bg-[#F8F9FC] rounded-xl p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <category.icon className="w-6 h-6 text-[#5B50D6]" />
                <h3 className="text-xl font-bold text-[#2D266F]">{category.title}</h3>
              </div>
              <ul className="space-y-3">
                {category.guides.map((guide) => (
                  <li key={guide}>
                    <Link
                      href="#"
                      className="flex items-center justify-between group text-gray-600 hover:text-[#5B50D6] transition-colors"
                    >
                      <span className="text-sm">{guide}</span>
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Code Example Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-16 bg-slate-950 rounded-xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <pre className="text-green-400 font-mono text-sm overflow-x-auto">
            <code>{`# Example: Running a sequence alignment
curl -X POST https://api.biostream.com/v1/align \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sequences": ["MKTIIALSYIFCLVFAD...", "MKWVTFISLLFLFSS..."],
    "algorithm": "clustalw",
    "output_format": "fasta"
  }'`}</code>
          </pre>
        </motion.div>
      </div>
    </div>
  );
}