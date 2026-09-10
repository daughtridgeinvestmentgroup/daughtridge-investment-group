import { useRef, useState, type FormEvent } from "react";
import { FooterLogo, HeaderLogo, HeroLogo } from "./logo";
import { LegalDocs, PolicyLink } from "./legal-modals";
import { submitInquiry, PROPERTY_TYPES } from "./inquiries";

export type SitePage = "home" | "about" | "join" | "contact";

type Props = {
  initialPage?: SitePage;
};

export function PublicSite({ initialPage = "home" }: Props) {
  const [page, setPage] = useState<SitePage>(initialPage);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [propertyType, setPropertyType] = useState("");
  const submittingRef = useRef(false);

  function go(next: SitePage) {
    setPage(next);
    setMenuOpen(false);
    const hash = `#page-${next}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", hash);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setFormError(null);

    const terms = data.get("agree_terms") === "on";

    if (!terms) {
      setFormError("Please agree to the Terms & Conditions and Privacy Policy.");
      return;
    }

    const typeChoice = String(data.get("property_type") ?? "").trim();
    const typeOther = String(data.get("property_type_other") ?? "").trim();

    if (typeChoice === "Other" && !typeOther) {
      setFormError("Please enter the property type.");
      return;
    }

    const propertyTypeValue =
      typeChoice === "Other" ? `Other: ${typeOther}` : typeChoice;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      await submitInquiry({
        data: {
          firstName: String(data.get("first_name") ?? ""),
          lastName: String(data.get("last_name") ?? ""),
          email: String(data.get("email") ?? ""),
          phone: String(data.get("phone") ?? ""),
          propertyAddress: String(data.get("property_address") ?? ""),
          propertyType: propertyTypeValue,
          ownerName: String(data.get("owner_name") ?? ""),
          parcelPin: String(data.get("parcel_pin") ?? ""),
          acreage: String(data.get("acreages") ?? ""),
          additionalNote: String(data.get("additional_note") ?? ""),
          smsConsent: data.get("sms_consent") === "on",
          termsAccepted: true,
          privacyAccepted: true,
          honey: String(data.get("website") ?? ""),
        },
      });

      form.reset();
      setPropertyType("");
      setSubmitted(true);
    } catch {
      setFormError(
        "We're sorry, but we were unable to submit your information at this time. Please try again.",
      );
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="site">
      <header className="header">
        <button type="button" className="logo-link" onClick={() => go("home")}>
          <HeaderLogo />
        </button>

        <button
          type="button"
          className="menu-toggle"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          Menu
        </button>

        <nav>
          <ul className={`nav${menuOpen ? " open" : ""}`}>
            <li>
              <a
                href="#page-home"
                className={page === "home" ? "active" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  go("home");
                }}
              >
                Home
              </a>
            </li>

            <li>
              <a
                href="#page-about"
                className={page === "about" ? "active" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  go("about");
                }}
              >
                About Us
              </a>
            </li>

            <li>
              <a
                href="#page-join"
                className={page === "join" ? "active" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  go("join");
                }}
              >
                Join Now
              </a>
            </li>

            <li>
              <a
                href="#page-contact"
                className={page === "contact" ? "active" : ""}
                onClick={(e) => {
                  e.preventDefault();
                  go("contact");
                }}
              >
                Contact Us
              </a>
            </li>
          </ul>
        </nav>
      </header>

      <div
        id="page-home"
        className={`page-section${page === "home" ? " active" : ""}`}
      >
        <section className="hero">
          <div className="hero-brand">
            <div className="hero-logo">
              <HeroLogo />
            </div>
          </div>

          <div className="hero-photo">
            <div className="hero-bg" />
            <div className="hero-overlay" />

            <div className="hero-content">
              <div className="hero-name">
                <h1 className="hero-title">DAUGHTRIDGE</h1>
                <p className="hero-sub">Investment Group LLC</p>
              </div>

              <button className="btn" type="button" onClick={() => go("join")}>
                Let's Start
              </button>
            </div>
          </div>
        </section>

        <section className="building">
          <div className="building-inner">
            <div>
              <img
                src="/construction.jpg"
                alt="Home under construction"
                loading="eager"
                decoding="async"
              />
            </div>

            <div>
              <h2>
                Building Stronger
                <br />
                <span>Communities Since 2009</span>
              </h2>

              <p>
                Located in Rocky Mount, NC, Daughtridge Investment Group LLC has
                proudly served Edgecombe, Wilson, and Nash Counties for over a
                decade. Since 2009, our mission has been simple yet powerful:
                create affordable housing and restore homes back to livable
                conditions.
              </p>

              <button
                className="btn btn-outline"
                type="button"
                onClick={() =>
                  document
                    .getElementById("learn-more-section")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Learn More
              </button>
            </div>
          </div>
        </section>

        <section className="specializes" id="learn-more-section">
          <p className="intro">
            We believe every property has potential — whether it’s a house that
            needs some love or a vacant piece of land waiting for its next
            opportunity.
          </p>

          <h3>Our company specializes in:</h3>

          <div className="cards">
            <div className="card">
              <h4>Buying homes in need of renovation</h4>
              <p>
                Buying homes in need of renovation and bringing them back to
                life with care, quality, and craftsmanship.
              </p>
            </div>

            <div className="card">
              <h4>Restoring neighborhoods</h4>
              <p>
                Restoring neighborhoods by turning neglected properties into
                safe, welcoming homes for families.
              </p>
            </div>

            <div className="card">
              <h4>Purchasing land and houses directly</h4>
              <p>
                Purchasing land and houses directly, offering fair, transparent
                solutions for property owners.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div
        id="page-about"
        className={`page-section${page === "about" ? " active" : ""}`}
      >
        <section className="about">
          <div className="about-inner">
            <div className="vm-grid">
              <div className="vm-text">
                <h2>Vision</h2>

                <p>
                  To be a leading force in community renewal and affordable
                  housing, where every family has access to a safe, comfortable
                  home and every property contributes to a stronger, more
                  vibrant North Carolina.
                </p>

                <h2 style={{ marginTop: "2rem" }}>Mission</h2>

                <p>
                  To revitalize communities by buying and restoring homes that
                  need care and transforming land into valuable opportunities.
                  We are dedicated to creating affordable, quality housing while
                  improving neighborhoods across Edgecombe, Wilson, and Nash
                  Counties through integrity, craftsmanship, and community
                  partnership.
                </p>
              </div>

              <div className="vm-images">
                <img
                  src="/interior1.jpg"
                  alt="Interior"
                  loading="lazy"
                  decoding="async"
                />

                <img
                  src="/interior2.jpg"
                  alt="Home interior"
                  loading="lazy"
                  decoding="async"
                />

                <img
                  src="/interior3.jpg"
                  alt="Living space"
                  loading="lazy"
                  decoding="async"
                  style={{ gridColumn: "1 / -1", height: 210 }}
                />
              </div>
            </div>

            <div className="why">
              <h2>Why Choose Us?</h2>

              <div className="why-grid">
                <div className="why-box">
                  <h4>Experience you can trust</h4>
                  <p>
                    Over 15 years of proven work in housing and community
                    restoration.
                  </p>
                </div>

                <div className="why-box">
                  <h4>Local focus</h4>
                  <p>Deep roots in Rocky Mount and surrounding counties.</p>
                </div>

                <div className="why-box">
                  <h4>Affordable housing solutions</h4>
                  <p>
                    Dedicated to creating homes that families can truly afford.
                  </p>
                </div>

                <div className="why-box">
                  <h4>Community impact</h4>
                  <p>
                    Every renovation and build strengthens the neighborhoods we
                    serve.
                  </p>
                </div>
              </div>

              <button
                className="btn btn-solid"
                type="button"
                onClick={() => go("join")}
              >
                Let's Start
              </button>
            </div>
          </div>
        </section>
      </div>

      <div
        id="page-join"
        className={`page-section${page === "join" ? " active" : ""}`}
      >
        <section className="join">
          <div className="join-inner">
            {submitted ? (
              <div className="thank-you">
                <h2>Thank You!</h2>

                <p>
                  Your information has been successfully submitted to
                  Daughtridge Investment Group LLC.
                </p>

                <p>
                  We appreciate your interest. A member of our team will review
                  your information and contact you regarding your inquiry.
                </p>

                <button
                  className="btn btn-solid"
                  type="button"
                  style={{ marginTop: "1.5rem" }}
                  onClick={() => {
                    setSubmitted(false);
                    setSubmitting(false);
                    submittingRef.current = false;
                    go("home");
                  }}
                >
                  RETURN TO HOME
                </button>
              </div>
            ) : (
              <>
                <h2>Let's Build Together</h2>

                <p className="lead">
                  Looking to sell your land or house? At Daughtridge Investment
                  Group LLC, we make the process simple, fair, and
                  stress-free.
                  <br />
                  <br />
                  When you click “SUBMIT FORM,” you're taking the first step
                  toward a smooth transaction with a trusted local team that
                  values integrity and community.
                </p>

                <form onSubmit={onSubmit} noValidate={false}>
                  <input
                    type="text"
                    name="website"
                    autoComplete="off"
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{ display: "none" }}
                  />

                  <div className="form-section-title">
                    Contact Information
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="first">First *</label>
                      <input
                        type="text"
                        id="first"
                        name="first_name"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="last">Last *</label>
                      <input
                        type="text"
                        id="last"
                        name="last_name"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="email">Email *</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="phone">Phone *</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="address">Property Address</label>
                    <input
                      type="text"
                      id="address"
                      name="property_address"
                    />
                  </div>

                  <div
                    className={`form-row property-type-row${
                      propertyType === "Other" ? " show-other" : ""
                    }`}
                  >
                    <div className="form-group">
                      <label htmlFor="property-type">Property Type</label>

                      <select
                        id="property-type"
                        name="property_type"
                        defaultValue=""
                        onChange={(e) => setPropertyType(e.target.value)}
                      >
                        <option value="">Select property type</option>

                        {PROPERTY_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group property-type-other">
                      <label htmlFor="property-type-other">
                        Specify property type
                      </label>

                      <input
                        type="text"
                        id="property-type-other"
                        name="property_type_other"
                        placeholder="Enter property type"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="owner">Owner’s Name</label>
                    <input type="text" id="owner" name="owner_name" />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="parcel">Parcel / PIN</label>
                      <input type="text" id="parcel" name="parcel_pin" />
                    </div>

                    <div className="form-group">
                      <label htmlFor="acreage">Acreage</label>
                      <input type="text" id="acreage" name="acreages" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="notes">Additional Note</label>
                    <textarea id="notes" name="additional_note" />
                  </div>

                  <div className="checks">
                    <div className="check-item">
                      <input
                        type="checkbox"
                        id="terms"
                        name="agree_terms"
                        required
                      />

                      <div>
                        By checking this box, you acknowledge that you have
                        read, understood, and agree to the{" "}
                        <PolicyLink kind="terms">
                          Terms & Conditions
                        </PolicyLink>{" "}
                        and{" "}
                        <PolicyLink kind="privacy">
                          Privacy Policy
                        </PolicyLink>
                        .
                      </div>
                    </div>

                    <div className="check-item">
                      <input
                        type="checkbox"
                        id="sms"
                        name="sms_consent"
                      />

                      <label htmlFor="sms">
                        By entering your phone number and checking the consent
                        box, you agree to receive text messages from Daughtridge
                        Investment Group LLC. Message frequency may vary.
                        Standard message and data rates may apply.
                        <br />
                        <br />
                        You consent to be contacted regarding property
                        opportunities, lot acquisitions, and manufactured home
                        projects in North Carolina and Florida.
                        <br />
                        <br />
                        Your information will be handled with care, and you may
                        opt out at any time. Reply STOP to opt out at any time.
                        Reply HELP for help.
                      </label>
                    </div>
                  </div>

                  {formError ? (
                    <p className="form-error">{formError}</p>
                  ) : null}

                  <div className="submit-wrap">
                    <button
                      type="submit"
                      className="submit-btn"
                      disabled={submitting}
                    >
                      {submitting ? "SUBMITTING..." : "Submit Form"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </div>

      <div
        id="page-contact"
        className={`page-section${page === "contact" ? " active" : ""}`}
      >
        <section className="about" style={{ paddingBottom: "2rem" }}>
          <div
            className="about-inner"
            style={{ textAlign: "center", maxWidth: 600 }}
          >
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                color: "var(--brown)",
                fontSize: "2.1rem",
                marginBottom: "1rem",
              }}
            >
              Contact Us
            </h2>

            <p
              style={{
                color: "var(--text-light)",
                marginBottom: "1.5rem",
              }}
            >
              Reach out to us anytime. We are happy to discuss how we can help
              with your property.
            </p>

            <p style={{ fontSize: "1.05rem", lineHeight: 1.9 }}>
              <strong>Rocky Mount, NC</strong>
              <br />
              Tel: (252) 320-3440
              <br />
              Daughtridgeinvestmentgroup@gmail.com
            </p>

            <p
              style={{
                marginTop: "1.5rem",
                color: "var(--text-light)",
              }}
            >
              <strong>Business Hours</strong>
              <br />
              Monday – Friday: 9am – 6pm
              <br />
              Saturday: 9am – 12nn
            </p>

            <button
              className="btn btn-solid"
              type="button"
              style={{ marginTop: "2rem" }}
              onClick={() => go("join")}
            >
              Join Us / Get My Offer
            </button>
          </div>
        </section>
      </div>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-logo">
            <FooterLogo />
          </div>

          <div className="footer-grid">
            <div className="footer-col">
              <h4>Join our community</h4>

              <p>
                Rocky Mount, NC
                <br />
                Tel: (252) 320-3440
                <br />
                Daughtridgeinvestmentgroup@gmail.com
              </p>
            </div>

            <div className="footer-col">
              <h4>Business Hours</h4>

              <p>
                Monday – Friday: 9am – 6pm
                <br />
                Saturday: 9am – 12nn
              </p>
            </div>
          </div>

          <hr className="footer-divider" />

          <div className="social">
            <span>Get social</span>

            <a
              className="social-facebook"
              href="https://www.facebook.com/profile.php?id=61594193734622"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#1877F2"
                  d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.887v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
                />
              </svg>

              <span>Facebook</span>
            </a>

            <a
              className="social-instagram"
              href="https://www.instagram.com/daughtridgeinvestmentgroup/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <defs>
                  <linearGradient
                    id="ig-grad"
                    x1="0%"
                    y1="100%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="#f58529" />
                    <stop offset="45%" stopColor="#dd2a7b" />
                    <stop offset="100%" stopColor="#515bd4" />
                  </linearGradient>
                </defs>

                <rect
                  x="2"
                  y="2"
                  width="20"
                  height="20"
                  rx="6"
                  fill="url(#ig-grad)"
                />

                <circle
                  cx="12"
                  cy="12"
                  r="4.15"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1.85"
                />

                <circle
                  cx="17.15"
                  cy="6.9"
                  r="1.15"
                  fill="#fff"
                />
              </svg>

              <span>Instagram</span>
            </a>
          </div>

          <div className="footer-policies">
            <PolicyLink kind="terms">Terms & Conditions</PolicyLink>
            <PolicyLink kind="privacy">Privacy Policy</PolicyLink>
          </div>

          <div className="footer-bottom">
            Copyright © 2026 All rights reserved.

            <div>
              <a href="#/admin" className="owner-login">
                Owner login
              </a>
            </div>
          </div>
        </div>
      </footer>

      <LegalDocs />
    </div>
  );
}
