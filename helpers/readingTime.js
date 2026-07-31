function calculateReadingTime(content) {
    const wordCount = content.trim().split(/\s+/).length;

    return Math.max(1, Math.ceil(wordCount / 200));
}

export default calculateReadingTime;