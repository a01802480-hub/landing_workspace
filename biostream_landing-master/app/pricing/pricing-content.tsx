'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import Link from 'next/link';

export default function PricingContent() {
  const [isAnnual, setIsAnnual] = useState(true);

  const plans = [
    {
      name: 'Basic',
      price: isAnnual ? 49 : 59,
      description: 'Perfect for individual researchers',
      features: [
        'Up to 100 sequences/month',
        'Basic alignment algorithms',
        'Standard support',
        'Export to FASTA/GBK',
        '5 GB storage',
      ],
      notIncluded: ['Advanced analytics', 'API access', 'Priority support'],
      cta: 'Get Started',
      popular: false,
    },
    {
      name: 'Pro',
      price: isAnnual ? 99 : 119,
      description: 'For professional research teams',
      features: [
        'Unlimited sequences',
        'All alignment algorithms',
        'Priority support',
        'Advanced export formats',
        '50 GB storage',
        'API access',
        'Advanced analytics',
        'Custom workflows',
      ],
      notIncluded: [],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      description: 'For large-scale institutions',
      features: [
        'Everything in Pro',
        'Unlimited storage',
        'Dedicated support',
        'Custom integrations',
        'SLA guarantee',
        'On-premise deployment',
        'Training & onboarding',
      ],
      notIncluded: [],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-white pt-24 pb-16 px-6 lg:px-24">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl font-bold text-[#2D266F] mb-4 tracking-wide">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Choose the perfect plan for your protein analysis needs. All plans include a 14-day free trial.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-sm ${!isAnnual ? 'text-[#2D266F] font-semibold' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-14 h-8 bg-[#5B50D6] rounded-full p-1 transition-colors"
            >
              <motion.div
                animate={{ x: isAnnual ? 24 : 0 }}
                className="w-6 h-6 bg-white rounded-full shadow-md"
              />
            </button>
            <span className={`text-sm ${isAnnual ? 'text-[#2D266F] font-semibold' : 'text-gray-500'}`}>
              Annual
              <span className="ml-2 text-xs text-[#5B50D6] font-medium">Save 20%</span>
            </span>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className={`relative bg-[#F8F9FC] rounded-2xl p-8 ${
                plan.popular ? 'ring-2 ring-[#5B50D6] shadow-xl' : 'hover:shadow-lg'
              } transition-shadow`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-[#5B50D6] text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-[#2D266F] mb-2">{plan.name}</h3>
                <p className="text-gray-600 text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-5xl font-bold text-[#2D266F]">
                  {typeof plan.price === 'number' ? `$${plan.price}` : plan.price}
                </span>
                {typeof plan.price === 'number' && (
                  <span className="text-gray-500">/month</span>
                )}
              </div>

              <Link href="/signin">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full py-3 rounded-lg font-semibold mb-8 transition-all ${
                    plan.popular
                      ? 'bg-[#5B50D6] text-white hover:bg-[#4a42b8]'
                      : 'bg-white border-2 border-[#5B50D6] text-[#5B50D6] hover:bg-[#5B50D6] hover:text-white'
                  }`}
                >
                  {plan.cta}
                </motion.button>
              </Link>

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-600 text-sm">{feature}</span>
                  </li>
                ))}
                {plan.notIncluded.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 opacity-50">
                    <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-500 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-3xl font-bold text-[#2D266F] text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'Can I change plans later?',
                a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, PayPal, and wire transfers for enterprise accounts.',
              },
              {
                q: 'Is there a free trial?',
                a: 'Yes! All plans come with a 14-day free trial. No credit card required.',
              },
              {
                q: 'Do you offer academic discounts?',
                a: 'Yes, we offer special pricing for academic institutions. Contact our sales team for details.',
              },
            ].map((faq, index) => (
              <div key={index} className="bg-[#F8F9FC] rounded-lg p-6">
                <h3 className="font-semibold text-[#2D266F] mb-2">{faq.q}</h3>
                <p className="text-gray-600 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}