// SkyCast product data helpers. Keep UI logic in script.js and weather mappings here as the app grows.
const SKYCAST_INSIGHTS = {
  comfort: (temp, humidity) => {
    if (temp >= 35) return ["Low", "Very hot outside"];
    if (temp >= 30 && humidity >= 70) return ["Fair", "Warm and humid"];
    if (temp <= 12) return ["Low", "Quite chilly"];
    return ["Good", "Comfortable conditions"];
  },
  rainLabel: chance => chance >= 70 ? "High" : chance >= 40 ? "Medium" : "Low"
};
