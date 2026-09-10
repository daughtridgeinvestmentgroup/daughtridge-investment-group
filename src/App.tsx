import { useEffect, useState } from "react";
import { PublicSite } from "./public-site";
import { Admin } from "./Admin";
import "./site.css";
import "./admin.css";

export function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (hash.startsWith("#/admin")) return <Admin />;
  return <PublicSite />;
}
