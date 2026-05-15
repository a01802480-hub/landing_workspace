/**
 * Color schemes for DNA and Protein sequences, based on biochemical properties.
 */

// Protein color scheme based on chemical properties
const proteinColorMap: { [key: string]: string } = {
  // Aromatic (highest priority)
  F: 'bg-purple-400', W: 'bg-purple-400', Y: 'bg-purple-400',
  // Hydrophobic (non-aromatic)
  A: 'bg-orange-400', I: 'bg-orange-400', L: 'bg-orange-400', M: 'bg-orange-400',
  V: 'bg-orange-400', P: 'bg-orange-400', G: 'bg-orange-400',
  // Polar
  S: 'bg-green-400', T: 'bg-green-400', C: 'bg-green-400', N: 'bg-green-400',
  Q: 'bg-green-400',
  // Charged (acidic/basic)
  D: 'bg-blue-400', E: 'bg-blue-400', K: 'bg-blue-400', H: 'bg-blue-400',
  R: 'bg-blue-400',
  // Gap
  '-': 'bg-gray-700',
};

/**
 * Returns a Tailwind CSS background color class for a given amino acid.
 * @param char The amino acid character (or gap '-')
 * @returns A string with Tailwind CSS class, e.g., "bg-orange-400".
 */
export const getProteinColor = (char: string): string => {
  return proteinColorMap[char.toUpperCase()] || 'bg-gray-400'; // Default for unknown chars
};

/**
 * Legend for the protein color scheme.
 */
export const proteinColorLegendsWithDesc = [
    { color: 'bg-orange-400', name: 'Hydrophobic', letters: 'A, I, L, M, V, P, G' },
    { color: 'bg-green-400', name: 'Polar', letters: 'S, T, C, N, Q' },
    { color: 'bg-blue-400', name: 'Charged', letters: 'D, E, K, H, R' },
    { color: 'bg-purple-400', name: 'Aromatic', letters: 'F, W, Y' },
];