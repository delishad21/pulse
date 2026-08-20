export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              const stored = localStorage.getItem("pulse-theme");
              const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              const dark = stored === "dark" || (!stored && prefersDark);
              if (dark) document.documentElement.classList.add("dark");
              else document.documentElement.classList.remove("dark");
            } catch (e) {}
          })();
        `,
      }}
    />
  );
}
