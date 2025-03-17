
import React from "react";

import { Link } from "wouter";

export function Footer() {
  return (
    <Link href="/">
      <footer className="fixed bottom-6 right-6 text-3xl font-semibold bg-primary/10 text-primary px-6 py-3 rounded-lg backdrop-blur-sm cursor-pointer hover:bg-primary/20 transition-colors" style={{ fontFamily: 'Didot, "Didot LT STD", "Bodoni MT", "ltc-bodoni-175", "Hoefler Text", Garamond, "Times New Roman", serif' }}>
        Transac
      </footer>
    </Link>
  );
}
