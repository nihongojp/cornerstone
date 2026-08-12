import ForgotPassword from "../../../pages-client/ForgotPassword";

// Public, matching the CRA route — it was never behind the PublicOnly guard.
export default function Page() {
  return <ForgotPassword />;
}
