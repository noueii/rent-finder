import Link from "next/link";

const footerLinks = {
  features: [
    { label: "Commute-based search", href: "/" },
    { label: "Standard search", href: "/search" },
    { label: "Interactive browsing", href: "/browse" },
    { label: "Save favorites", href: "/lists" },
  ],
  resources: [
    { label: "Station Guide", href: "/stations" },
    { label: "How It Works", href: "/how-it-works" },
    { label: "FAQ", href: "/faq" },
    { label: "API Docs", href: "/api-docs" },
  ],
  company: [
    { label: "About Us", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
};

export function Footer() {
  return (
    <footer className="mt-auto border-t w-full flex">
      <div className="py-8 w-full flex justify-center items-center">
        <div className="flex gap-4">
          <div>
            <h3 className="mb-3 font-semibold">About</h3>
            <p className="text-sm text-muted-foreground">
              Find your perfect apartment in Tokyo based on commute time to your workplace.
            </p>
          </div>
          
          <div>
            <h3 className="mb-3 font-semibold">Features</h3>
            <ul className="space-y-2">
              {footerLinks.features.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="mb-3 font-semibold">Resources</h3>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h3 className="mb-3 font-semibold">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 Tokyo Apartment Finder. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}