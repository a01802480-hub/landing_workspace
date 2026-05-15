'use client';

import { motion } from 'framer-motion';
import { Dna, Target, Users, Award } from 'lucide-react';

export default function AboutContent() {
  const team = [
    {
      name: 'Dr. Sarah Chen',
      role: 'Founder & CEO',
      bio: 'Former structural biologist at MIT with 15+ years in protein research.',
      avatar: 'SC',
    },
    {
      name: 'Dr. James Rodriguez',
      role: 'Chief Scientist',
      bio: 'PhD in Computational Biology, pioneer in sequence alignment algorithms.',
      avatar: 'JR',
    },
    {
      name: 'Emily Watson',
      role: 'Head of Engineering',
      bio: 'Ex-Google engineer specializing in high-performance computing.',
      avatar: 'EW',
    },
    {
      name: 'Dr. Michael Park',
      role: 'Lead Bioinformatician',
      bio: 'Expert in evolutionary genomics and comparative analysis.',
      avatar: 'MP',
    },
  ];

  const milestones = [
    { year: '2020', event: 'BioStream founded at Stanford Bio-X' },
    { year: '2021', event: 'First 1,000 researchers onboard' },
    { year: '2022', event: 'Series A funding - $10M raised' },
    { year: '2023', event: 'Launched API platform' },
    { year: '2024', event: '10,000+ active users worldwide' },
  ];

  return (
    <div className="min-h-screen bg-white pt-24 pb-16 px-6 lg:px-24">
      <div className="max-w-6xl mx-auto">
        {/* Mission Statement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h1 className="text-5xl font-bold text-[#2D266F] mb-6 tracking-wide">Our Mission</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            To democratize access to advanced protein analysis tools and empower researchers 
            worldwide to make groundbreaking discoveries in structural biology.
          </p>
        </motion.div>

        {/* Values */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {[
            {
              icon: Target,
              title: 'Precision',
              description: 'Scientific rigor in every calculation and analysis.',
            },
            {
              icon: Users,
              title: 'Accessibility',
              description: 'Making advanced tools available to all researchers.',
            },
            {
              icon: Award,
              title: 'Innovation',
              description: 'Pushing the boundaries of computational biology.',
            },
          ].map((value, index) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className="bg-[#F8F9FC] rounded-xl p-8 text-center"
            >
              <value.icon className="w-12 h-12 text-[#5B50D6] mx-auto mb-4" />
              <h3 className="text-xl font-bold text-[#2D266F] mb-3">{value.title}</h3>
              <p className="text-gray-600">{value.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Team Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-20"
        >
          <h2 className="text-3xl font-bold text-[#2D266F] text-center mb-12">Meet Our Team</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((member, index) => (
              <motion.div
                key={member.name}
                whileHover={{ scale: 1.05 }}
                className="bg-[#F8F9FC] rounded-xl p-6 text-center"
              >
                <div className="w-20 h-20 bg-[#5B50D6] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-white">{member.avatar}</span>
                </div>
                <h3 className="font-bold text-[#2D266F] mb-1">{member.name}</h3>
                <p className="text-sm text-[#5B50D6] mb-3">{member.role}</p>
                <p className="text-xs text-gray-600">{member.bio}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <h2 className="text-3xl font-bold text-[#2D266F] text-center mb-12">Our Journey</h2>
          <div className="relative">
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-[#5B50D6]/20" />
            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <motion.div
                  key={milestone.year}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -40 : 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.6 }}
                  className={`flex items-center ${
                    index % 2 === 0 ? 'justify-start' : 'justify-end'
                  }`}
                >
                  <div
                    className={`w-5/12 ${
                      index % 2 === 0 ? 'text-right pr-8' : 'text-left pl-8'
                    }`}
                  >
                    <div className="bg-[#F8F9FC] rounded-lg p-4 inline-block">
                      <span className="text-[#5B50D6] font-bold text-lg">{milestone.year}</span>
                      <p className="text-gray-600 text-sm mt-1">{milestone.event}</p>
                    </div>
                  </div>
                  <div className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 bg-[#5B50D6] rounded-full border-4 border-white shadow" />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-20 text-center bg-[#F8F9FC] rounded-2xl p-12"
        >
          <Dna className="w-16 h-16 text-[#5B50D6] mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-[#2D266F] mb-4">Join Our Mission</h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Be part of the revolution in protein analysis. Start your free trial today.
          </p>
          <a
            href="/signin"
            className="inline-block px-8 py-4 bg-[#5B50D6] text-white rounded-lg font-semibold hover:bg-[#4a42b8] transition-colors"
          >
            Get Started Free
          </a>
        </motion.div>
      </div>
    </div>
  );
}