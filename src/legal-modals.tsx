import { HeaderLogo } from "./logo";

export function LegalDocs() {
  return (
    <>
      <div id="legal-terms" popover="auto" className="modal legal-popover">
        <div className="modal-logo">
          <HeaderLogo />
        </div>
        <TermsBody />
        <button
          className="modal-close-btn"
          type="button"
          popoverTarget="legal-terms"
          popoverTargetAction="hide"
        >
          Close
        </button>
      </div>
      <div id="legal-privacy" popover="auto" className="modal legal-popover">
        <div className="modal-logo">
          <HeaderLogo />
        </div>
        <PrivacyBody />
        <button
          className="modal-close-btn"
          type="button"
          popoverTarget="legal-privacy"
          popoverTargetAction="hide"
        >
          Close
        </button>
      </div>
    </>
  );
}

export function PolicyLink({
  kind,
  children,
}: {
  kind: "terms" | "privacy";
  children: string;
}) {
  const id = kind === "terms" ? "legal-terms" : "legal-privacy";
  return (
    <button
      type="button"
      className="policy-link"
      popoverTarget={id}
      popoverTargetAction="show"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const el = document.getElementById(id);
        if (el && "showPopover" in el) {
          try {
            (el as HTMLElement & { showPopover: () => void }).showPopover();
          } catch {
            /* already open */
          }
        }
      }}
    >
      {children}
    </button>
  );
}

function TermsBody() {
  return (
    <>
      <h3>Terms & Conditions</h3>
      <p className="modal-updated">Last Updated: June 2, 2025</p>
      <p>
        Welcome to our website. This Terms of Use agreement governs your use of
        the Daughtridge Investment Group LLC website. Please read these terms
        carefully before accessing or using our site. By using our website, you
        acknowledge that you have read, understood, and agree to be bound by
        these terms. If you do not agree, please refrain from using our website.
      </p>
      <h4>1. Intellectual Property</h4>
      <p>
        All content on our website—including text, graphics, logos, images,
        audio clips, digital downloads, and software—is the property of
        Daughtridge Investment Group LLC or its content providers and is
        protected by international copyright laws. You may not use, copy,
        reproduce, distribute, modify, transmit, display, or create derivative
        works from any content without prior written consent.
      </p>
      <h4>2. User Conduct</h4>
      <p>By using our website, you agree to the following:</p>
      <ul>
        <li>
          You are responsible for maintaining the confidentiality of your
          account and password and for all activities that occur under your
          account.
        </li>
        <li>You will not use the website for any unlawful or unauthorized purpose.</li>
        <li>
          You will not interfere with the operation of the website or its
          connected networks.
        </li>
        <li>
          You will not attempt to gain unauthorized access to any part of the
          website, other user accounts, or connected systems.
        </li>
        <li>
          You will not overload, disrupt, or interfere with the infrastructure
          of the website.
        </li>
        <li>
          You will not upload or post content that is offensive, defamatory,
          obscene, or infringes upon the rights of any third party.
        </li>
        <li>
          You will not engage in spamming, including sending unsolicited
          messages or emails.
        </li>
      </ul>
      <h4>3. Links to Third-Party Websites</h4>
      <p>
        Our website may contain links to external sites not owned or controlled
        by us. We do not endorse or take responsibility for the content or
        practices of these third-party websites. Access them at your own risk
        and review their terms and privacy policies.
      </p>
      <h4>4. Disclaimer and Limitation of Liability</h4>
      <p>
        Our website is provided “as is” and “as available,” without warranties
        of any kind. We make no representations regarding the accuracy or
        completeness of its content.
      </p>
      <p>
        To the fullest extent permitted by law, Daughtridge Investment Group LLC
        is not liable for any direct, indirect, incidental, special, or
        consequential damages arising from your use of the website, including
        loss of data, profits, or business interruption.
      </p>
      <h4>5. Indemnification</h4>
      <p>
        You agree to indemnify and hold harmless Daughtridge Investment Group
        LLC from any claims, damages, liabilities, or expenses (including
        attorney’s fees) arising from your use of the website or any violation
        of these terms.
      </p>
      <h4>6. Amendments</h4>
      <p>
        We may update these Terms of Use at any time without prior notice. It
        is your responsibility to review them periodically. Continued use of
        our website constitutes your acceptance of any changes.
      </p>
      <h4>7. Governing Law</h4>
      <p>
        These terms shall be governed by the laws of the State of North
        Carolina. Any disputes shall be resolved exclusively in the courts
        located in North Carolina.
      </p>
      <p>
        If you have any questions about these Terms of Use, please contact us
        at admin@daughtridgeinvestmentgroup.com or (252) 320-3440.
      </p>
      <h4>Text Messaging Program</h4>
      <p>
        You may choose to receive recurring marketing messages and offers via
        text from Daughtridge Investment Group LLC about real estate services.
        By subscribing, you consent to receive these messages at the mobile
        number you provide. Consent is not required to purchase any goods,
        properties, or services.
      </p>
      <p>
        We may change the sending number or platform (for example, short code,
        long code, or toll-free) and will disclose all opt-out options as
        required by law. Message and data rates may apply.
      </p>
      <p>
        You may opt out at any time by texting STOP, QUIT, END, CANCEL, or
        UNSUBSCRIBE. After you opt out, you will receive a confirmation
        message, and you will no longer receive messages from us.
      </p>
      <p>Please note:</p>
      <ul>
        <li>
          Opting out of text messages does not automatically unsubscribe you
          from emails or other communications.
        </li>
        <li>To rejoin, sign up again as you did initially.</li>
        <li>
          For help, reply with HELP or email us at
          admin@daughtridgeinvestmentgroup.com.
        </li>
      </ul>
      <p>
        Message and data rates may apply. Message frequency varies. Contact
        your wireless provider for more information.
      </p>
      <p>
        These terms also apply to our messaging program, including the
        limitations on liability as outlined in the Terms of Use.
      </p>
      <p>
        Note: These terms do not apply to any independent partners or
        affiliates. If you receive texts from a partner, please contact them
        directly to opt out.
      </p>
    </>
  );
}

function PrivacyBody() {
  return (
    <>
      <h3>Privacy Policy</h3>
      <p className="modal-updated">Last Updated: June 2, 2025</p>
      <p>
        This Privacy Policy describes how Daughtridge Investment Group LLC
        collects, uses, and protects your personal information when you visit
        our real estate website. We respect your privacy and are committed to
        protecting your data.
      </p>
      <h4>1. Information We Collect</h4>
      <p>
        <strong>1.1 Personal Information.</strong> When you voluntarily provide
        your name, email, phone number, or other contact details, we collect
        and store this information. This may include your preferences, budget,
        or other relevant data.
      </p>
      <p>
        <strong>1.2 Usage Information.</strong> We automatically collect
        nonpersonal data such as IP address, browser type, device, and pages
        visited to enhance your experience and improve our services.
      </p>
      <p>
        <strong>1.3 Cookies and Tracking.</strong> We use cookies and similar
        tools to personalize content, analyze traffic, and enhance your
        experience. You can disable cookies via your browser settings, but some
        features may not function properly.
      </p>
      <h4>2. Use of Personal Information</h4>
      <p>We may use your information for the following:</p>
      <p>
        <strong>2.1 To Provide Services.</strong> To respond to inquiries, send
        property listings, and facilitate communication between buyers and
        sellers.
      </p>
      <p>
        <strong>2.2 To Improve Our Website.</strong> To develop new features,
        improve functionality, and perform market research.
      </p>
      <p>
        <strong>2.3 For Marketing Communications.</strong> With your consent, we
        may send promotional content. You may unsubscribe at any time using the
        link in the message or by contacting us.
      </p>
      <p>
        <strong>2.4 Legal Compliance.</strong> We may disclose your information
        as required by law or to protect our rights and safety or those of
        others.
      </p>
      <h4>3. Data Sharing</h4>
      <p>
        We do not sell or rent your personal information. We may share data in
        limited circumstances:
      </p>
      <p>
        <strong>3.1 Legal Obligations.</strong> To comply with legal
        requirements or enforce our terms.
      </p>
      <h4>4. Data Security</h4>
      <p>
        We use reasonable safeguards to protect your data. However, no online
        system is 100% secure, and we cannot guarantee absolute protection.
      </p>
      <h4>5. Your Rights</h4>
      <p>
        You have the right to access, update, delete, or restrict the use of
        your personal data. To exercise these rights, contact us using the
        information below.
      </p>
      <h4>6. Children’s Privacy</h4>
      <p>
        Our website is not intended for users under 18. We do not knowingly
        collect data from minors. If we become aware of such collection, we
        will delete it.
      </p>
      <h4>7. Changes to This Policy</h4>
      <p>
        We may revise this policy from time to time. Material updates will be
        posted on this page with the updated effective date. Please review it
        periodically.
      </p>
      <h4>8. Contact Us</h4>
      <p>
        If you have any questions or concerns regarding this Privacy Policy,
        please contact us:
      </p>
      <p>
        Address: Rocky Mount, North Carolina
        <br />
        Email: admin@daughtridgeinvestmentgroup.com
        <br />
        Phone: (252) 320-3440
      </p>
      <p>
        We are committed to resolving your concerns in a timely and
        professional manner.
      </p>
      <p>
        By using our website, you agree to this Privacy Policy and consent to
        our practices as described.
      </p>
    </>
  );
}
