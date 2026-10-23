import GoogleDiscountPage, { metadata } from "../../offers/inflatables-15/page";
export { metadata };
export default function Page() {
  return (
    <GoogleDiscountPage searchParams={Promise.resolve({ kind: "rental" })} />
  );
}
