/*
 * The cat that heads every auth screen. Shared so the sign-in surface and the
 * post-signup step cannot drift apart — they are one flow to the person walking
 * through them, and a cat that changes size between two screens of the same
 * flow reads as a bug.
 */
export default function AuthCat() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="https://cdn-icons-png.flaticon.com/512/9288/9288684.png"
      alt=""
      width={80}
      style={{ marginBottom: 12 }}
    />
  );
}
