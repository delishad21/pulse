// Background tasks must be defined at module scope before the app renders, so
// headless launches (silent pushes, background refresh) can find them.
import "./src/widgets/background";
import "expo-router/entry";
