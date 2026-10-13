import Link from "next/link";
import { location } from "@/data/site";
import {
  createJsonLdScript,
  generateBreadcrumbSchema,
  generateMetadata,
  generateServiceSchema,
  getCanonicalUrl,
} from "@/lib/metadata";
import { ServiceQuestions } from "@/components/ServiceQuestions";
import { rentalQuestions } from "@/data/service-questions";

export const metadata = generateMetadata({
  title: "Inflatable Rental Delivery Around Greenwood, SC",
  description:
    "Plan a Jumping Jax inflatable delivery around Greenwood, Abbeville, Ninety Six, and nearby communities. Confirm your event address and delivery estimate with our team.",
  canonicalUrl: getCanonicalUrl("/service-area"),
});

export default function ServiceAreaPage() {
  return (
    <main className="min-h-screen bg-cyan-50 px-4 py-10 text-slate-950 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={createJsonLdScript([
          generateBreadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Rental delivery", path: "/service-area" },
          ]),
          generateServiceSchema(
            "Inflatable rental delivery around Greenwood, SC",
            "Inflatable and party equipment delivery to Greenwood and the communities listed on this page. Confirm the event address and delivery estimate with Jumping Jax.",
            "/service-area",
            "Inflatable rental delivery",
          ),
        ])}
      />
      <article className="mx-auto max-w-5xl rounded-3xl border-2 border-cyan-200 bg-white p-5 sm:p-8">
        <nav aria-label="Breadcrumb" className="text-sm">
          <Link href="/" className="text-cyan-800 underline">
            Home
          </Link>{" "}
          / Rental delivery
        </nav>
        <h1 className="mt-5 text-3xl font-black sm:text-5xl">
          Inflatable rental delivery around Greenwood, SC
        </h1>
        <p className="mt-5 leading-7 text-slate-700">
          Bring a bounce house, water slide, obstacle course, foam party, or
          party equipment to your home, school, church, or event location.
          Jumping Jax is based in Greenwood, South Carolina.
        </p>
        <h2 className="mt-8 text-2xl font-black">Delivery communities</h2>
        <p className="mt-3 leading-7 text-slate-700">
          We provide rentals in Greenwood and nearby communities, including the
          locations below. Delivery depends on your exact event address,
          equipment, and date. Contact our team to confirm coverage and the
          delivery estimate before making plans.
        </p>
        <ul className="mt-5 grid list-inside list-disc gap-3 font-bold sm:grid-cols-2">
          {location.serviceAreas.map((city) => (
            <li key={city}>{city}, SC</li>
          ))}
        </ul>
        <h2 className="mt-8 text-2xl font-black">
          Prepare your rental request
        </h2>
        <ol className="mt-4 list-inside list-decimal space-y-3 leading-7 text-slate-700">
          <li>Choose your rental and read its age and setup requirements.</li>
          <li>
            Check your date and share the event address and available setup
            space.
          </li>
          <li>
            Submit your request for staff review and delivery confirmation.
          </li>
        </ol>
        <div className="mt-6 flex flex-wrap gap-4 font-bold">
          <Link
            href="/rentals/bounce-houses"
            className="text-cyan-800 underline"
          >
            Bounce houses
          </Link>
          <Link
            href="/rentals/water-slides"
            className="text-cyan-800 underline"
          >
            Water slides
          </Link>
          <Link
            href="/rentals/obstacle-courses"
            className="text-cyan-800 underline"
          >
            Obstacle courses
          </Link>
          <Link
            href="/rentals/foam-parties"
            className="text-cyan-800 underline"
          >
            Foam parties
          </Link>
          <Link href="/contact" className="text-pink-800 underline">
            Confirm your event address
          </Link>
        </div>
        <h2 className="mt-8 text-2xl font-black">
          Prefer a party at Jumping Jax?
        </h2>
        <p className="mt-3 leading-7 text-slate-700">
          Our indoor birthday parties and open play take place at the Greenwood
          facility.{" "}
          <Link
            href="/facility-parties"
            className="font-bold text-pink-800 underline"
          >
            See facility party packages and request a date
          </Link>
          , or{" "}
          <Link
            href="/#open-play"
            className="font-bold text-cyan-800 underline"
          >
            check current open play hours
          </Link>
          .
        </p>
      </article>
      <ServiceQuestions
        title="Rental delivery questions"
        questions={rentalQuestions}
      />
    </main>
  );
}
