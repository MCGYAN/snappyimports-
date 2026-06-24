/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./{app,components,libs,pages,hooks}/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Inter: UI, body, labels, buttons (functional)
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        // Poppins: headlines only (use font-heading or h1–h6)
        heading: ['var(--font-poppins)', 'var(--font-inter)', 'sans-serif'],
      },
      colors: {
        // Snappy Import — mandatory brand identity
        brand: {
          primary: '#0B1F3A', // Deep Navy — trust
          accent: '#F26B1D', // Orange — action / CTA
          surface: '#FFFFFF', // Background
          light: '#F5F7FA', // Light surfaces
          foreground: '#2B2B2B', // Body text
        },
      },
      maxWidth: {
        store: '1440px',
      },
      boxShadow: {
        store: '0 4px 24px -4px rgba(11, 31, 58, 0.08)',
        'store-lg': '0 12px 40px -8px rgba(11, 31, 58, 0.12)',
        'store-card': '0 2px 12px rgba(11, 31, 58, 0.06)',
        'store-card-hover': '0 20px 48px -12px rgba(242, 107, 29, 0.18)',
      },
      borderRadius: {
        store: '1rem',
        'store-lg': '1.25rem',
        'store-xl': '1.5rem',
      },
    },
  },
  plugins: [],
}

