// Addresses of the dev server. The deck is routed as `/<slide number>`; the URL is the state.
export const previewUrl = (port: number, slide = 1) => `http://localhost:${port}/${Math.max(1, Math.floor(slide))}`;
