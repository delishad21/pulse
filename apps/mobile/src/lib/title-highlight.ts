// Alpha 0, but not "transparent": React Native on Android stores colours as ARGB ints and reads 0 (transparent black)
// as "no colour set", so the text falls back to black. Transparent white is 0x00ffffff, which is kept as given.
export const INVISIBLE_TEXT_COLOR = "rgba(255, 255, 255, 0)";
