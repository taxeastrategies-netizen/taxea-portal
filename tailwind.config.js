/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			inter: ['Inter', 'sans-serif'],
  			jakarta: ['Plus Jakarta Sans', 'sans-serif'],
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			teal: {
  				DEFAULT: 'hsl(174 45% 28%)',
  				light: 'hsl(174 35% 90%)',
  				dark: 'hsl(174 50% 20%)',
  			},
  			gold: {
  				DEFAULT: 'hsl(43 65% 55%)',
  				light: 'hsl(43 80% 92%)',
  			},
  			sidebar: {
  				DEFAULT: 'hsl(215 30% 12%)',
  				foreground: 'hsl(210 20% 85%)',
  				active: 'hsl(174 45% 28%)',
  				hover: 'hsl(215 25% 18%)',
  			},
  			chart: {
  				'1': 'hsl(174 45% 28%)',
  				'2': 'hsl(43 65% 55%)',
  				'3': 'hsl(215 60% 55%)',
  				'4': 'hsl(0 72% 51%)',
  				'5': 'hsl(270 50% 55%)'
  			},
  		},
  		keyframes: {
  			'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
  			'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
  			'slide-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
  			'fade-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'slide-in': 'slide-in 0.3s ease-out',
  			'fade-in': 'fade-in 0.4s ease-out',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
}
