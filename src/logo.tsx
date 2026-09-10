const LOGO_SRC = "/logo.png";
const LOGO_ALT = "Daughtridge Investment Group LLC";

export function HeaderLogo() {
  return (
    <img
      className="logo-header"
      src={LOGO_SRC}
      alt={LOGO_ALT}
      width={180}
      height={148}
    />
  );
}

export function HeroLogo() {
  return (
    <img
      className="logo-hero-img"
      src={LOGO_SRC}
      alt=""
      width={320}
      height={262}
    />
  );
}

export function FooterLogo() {
  return (
    <img
      className="logo-footer"
      src={LOGO_SRC}
      alt={LOGO_ALT}
      width={140}
      height={115}
    />
  );
}
