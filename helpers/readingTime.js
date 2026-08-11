/**
 * Calculates estimated reading time for blog post content.
 * Assumes an average adult reading speed of 200 words per minute (WPM).
 * 
 * @param {string} content - The blog post text body
 * @returns {number} Estimated reading time in minutes (minimum 1)
 */
function calculateReadingTime(content) {
    if (!content || typeof content !== "string") return 1;

    const words = content.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    return Math.max(1, Math.ceil(wordCount / 200));
}

export default calculateReadingTime;