'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        className="lp-hamburger"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        {open
          ? <X size={22} strokeWidth={2.5} />
          : <Menu size={22} strokeWidth={2.5} />
        }
      </button>

      {open && (
        <nav className="lp-mobile-menu">
          <Link href="#features" className="lp-mobile-link" onClick={close}>Features</Link>
          <Link href="#shopify"  className="lp-mobile-link" onClick={close}>Shopify</Link>
          <Link href="#pricing"  className="lp-mobile-link" onClick={close}>Pricing</Link>
          <Link href="/auth/login" className="lp-mobile-link" onClick={close}>Sign in</Link>
          <Link href="/auth/sign-up" className="lp-btn lp-btn-primary lp-mobile-cta" onClick={close}>
            Get started free
          </Link>
        </nav>
      )}
    </>
  );
}
