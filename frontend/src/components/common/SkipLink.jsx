/** "Skip to main content" link: visually hidden until focused (WCAG 2.4.1). */
const SkipLink = ({ targetId = 'main-content' }) => (
  <a
    href={`#${targetId}`}
    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[10000] focus:rounded-xl focus:bg-teal-700 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg"
  >
    Skip to main content
  </a>
);

export default SkipLink;
