import Link from "next/link";

const summaryClassName =
  "cursor-pointer list-none rounded-xl px-4 py-4 text-lg font-black text-slate-950 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-500 [&::-webkit-details-marker]:hidden";

const sectionClassName =
  "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm";

const contentClassName =
  "border-t border-slate-200 px-4 py-5 text-sm font-semibold leading-7 text-slate-700 sm:px-5";

function ManualSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className={sectionClassName}>
      <summary className={summaryClassName}>
        <span className="flex items-center justify-between gap-4">
          <span>
            {number}. {title}
          </span>
          <span aria-hidden="true" className="shrink-0 text-sky-700">
            ＋
          </span>
        </span>
      </summary>
      <div className={contentClassName}>{children}</div>
    </details>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-6">{children}</ol>;
}

function Bullets({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6">{children}</ul>;
}

function Subheading({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 text-base font-black text-slate-950 first:mt-0">{children}</h3>;
}

export default function SocialPostsInstructionManual({
  socialPostsHref,
}: {
  socialPostsHref: string;
}) {
  return (
    <section
      aria-labelledby="social-posts-manual-title"
      className="mt-6 rounded-3xl border border-sky-200 bg-sky-50/60 p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-4 border-b border-sky-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-700">
            Help &amp; Instructions
          </p>
          <h2
            id="social-posts-manual-title"
            className="mt-2 text-3xl font-black text-slate-950"
          >
            Social Posts Instruction Manual
          </h2>
          <p className="mt-3 max-w-4xl text-sm font-semibold leading-7 text-slate-700">
            This guide explains each part of Social Posts one step at a time.
            You will not damage the website by opening a section, reading a
            draft, or clicking Cancel. Select any section below to open it.
          </p>
        </div>
        <Link
          href={socialPostsHref}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-violet-600 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          Open Social Posts
        </Link>
      </div>

      <div className="mt-5 rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 text-sm font-semibold leading-7 text-rose-950">
        <h3 className="text-lg font-black">Important: a person must review every post</h3>
        <p className="mt-2">
          Social Posts does not automatically place a post on Facebook or
          Instagram. Save, Approve, and Schedule only change the saved draft
          inside this website. After checking the draft, a person must copy the
          caption and add it to the correct social media account.
        </p>
        <Bullets>
          <li>Never publish a price, date, discount, or availability that you have not checked.</li>
          <li>Never include a customer name, phone number, address, or private booking details.</li>
          <li>Never upload or use a customer photo unless Jumping Jax has permission.</li>
          <li>Check the booking system before promising that a rental or party time is open.</li>
          <li>Ask the owner before publishing anything that is unclear.</li>
        </Bullets>
      </div>

      <div className="mt-5 space-y-3">
        <ManualSection number={1} title="What the Social Posts tool does">
          <p>
            Social Posts helps staff prepare Facebook and Instagram content. It
            can create a suggested title, caption, picture or video instructions,
            and a saved draft. It can also store an approval choice, a planned
            date and time, and a status such as Draft, Approved, Scheduled,
            Posted, Rejected, or Failed.
          </p>
          <Subheading>What it can do now</Subheading>
          <Bullets>
            <li>Create a new suggested draft from a Campaign and Post goal.</li>
            <li>Create a draft for Facebook, Instagram, or both.</li>
            <li>Create image or short video material when those services are available.</li>
            <li>Let a person edit, save, duplicate, approve, reject, schedule, or delete a draft.</li>
            <li>Show earlier drafts and read-only Marketing Memory based on saved post history.</li>
          </Bullets>
          <Subheading>What it cannot do now</Subheading>
          <Bullets>
            <li>It does not publish directly to Facebook or Instagram.</li>
            <li>It does not confirm real rental or party availability.</li>
            <li>It does not guarantee that a generated price, date, policy, or product detail is correct.</li>
            <li>It has no button that copies an entire finished caption and image together.</li>
            <li>
              Most advanced publication pages are inspection screens.
              Publication execution also has owner-only account connection and
              authorization setup controls, but none of these controls publish
              a social post.
            </li>
          </Bullets>
          <p className="mt-4">
            The draft creator may use artificial intelligence, often called AI,
            to suggest wording. If that service is unavailable, the tool can use
            built-in example patterns instead. Either kind of draft must be
            checked by a person.
          </p>
        </ManualSection>

        <ManualSection number={2} title="How to open Social Posts">
          <Steps>
            <li>Sign in to the Jumping Jax admin website.</li>
            <li>On the Operations Home page, find the card labeled <strong>Social Posts</strong>.</li>
            <li>Click or tap <strong>Social Posts</strong>.</li>
            <li>Wait for the page titled <strong>Social Post Drafts</strong> to open.</li>
          </Steps>
          <p className="mt-4">
            Near the top you will see <strong>Agent social post plan</strong>,
            then <strong>New social post</strong>, followed by saved draft cards.
            If there are no saved drafts, the page says <strong>No social post drafts yet.</strong>
          </p>
        </ManualSection>

        <ManualSection number={3} title="Understanding the Social Posts screen">
          <Subheading>Agent social post plan — the easiest place to begin</Subheading>
          <Bullets>
            <li>
              <strong>Campaign:</strong> Optional. Choose a prepared marketing
              theme, or leave <strong>Custom / no campaign</strong>. A campaign
              guides the kind of wording and image the tool suggests.
            </li>
            <li>
              <strong>Post goal:</strong> Choose what the post should accomplish.
              Choose <strong>Custom goal</strong> to type your own clear request.
            </li>
            <li>
              <strong>Custom goal:</strong> Appears only after you choose
              <strong> Custom goal</strong>. Type the exact subject and confirmed
              details you want the draft to discuss.
            </li>
            <li>
              <strong>Source image URL for video:</strong> Optional, but strongly
              recommended for video. A URL is the web address of a picture.
              Choose an existing rental or facility image, or paste a public
              picture address. A preview appears when the address can be opened.
            </li>
            <li>
              <strong>Platform:</strong> Choose <strong>Both</strong>,
              <strong> Facebook</strong>, or <strong>Instagram</strong>. This
              records the intended destination; it does not publish there.
            </li>
            <li>
              <strong>Media type:</strong> Choose <strong>Video</strong> or
              <strong> Image</strong>.
            </li>
            <li>
              <strong>Business focus:</strong> Choose <strong>Both</strong>,
              <strong> Rentals</strong>, or <strong>Facility parties</strong>.
              A selected Campaign may supply its own matching focus.
            </li>
            <li>
              <strong>Create AI Draft:</strong> Saves a new Draft and adds it to
              the saved post cards below. While working, the button says
              <strong> Creating...</strong>.
            </li>
          </Bullets>

          <Subheading>New social post — manual test draft</Subheading>
          <p>
            This area is labeled <strong>Create Test Draft</strong>. It is for
            manually entering a draft instead of asking the draft creator to
            prepare one.
          </p>
          <Bullets>
            <li><strong>Title:</strong> Required. A short name used to identify the saved draft.</li>
            <li><strong>Media URL:</strong> Optional. The public web address of a finished image or video.</li>
            <li><strong>Source image URL for video:</strong> Optional, but recommended for video creation.</li>
            <li><strong>Prompt:</strong> Required. Instructions describing the content to create.</li>
            <li><strong>Caption:</strong> Required. The words intended for the social media post.</li>
            <li><strong>Media type:</strong> Choose Image or Video.</li>
            <li>
              <strong>Post placement:</strong> Choose Feed, Story, Reel,
              Carousel, or Search / ad placement. The choice controls the
              recommended picture shape.
            </li>
            <li><strong>Platforms:</strong> Check Facebook, Instagram, or both.</li>
            <li><strong>Create Test Draft:</strong> Saves the manually entered information as a Draft.</li>
          </Bullets>

          <Subheading>Each saved post card</Subheading>
          <Bullets>
            <li>The top shows the image or video preview, media type, title, and current status.</li>
            <li>The card shows the Caption, Prompt, Platforms, and Scheduled for date and time.</li>
            <li><strong>Edit</strong> opens all editable fields.</li>
            <li><strong>Duplicate</strong> creates a separate new Draft that can be reused.</li>
            <li><strong>Delete</strong> asks for confirmation, then permanently removes the draft.</li>
            <li><strong>Approve</strong> changes the saved status to Approved. It does not publish.</li>
            <li><strong>Reject</strong> changes the saved status to Rejected.</li>
            <li><strong>Schedule</strong> records the chosen date and time and changes the status to Scheduled. It does not create an automatic Facebook or Instagram post.</li>
          </Bullets>

          <Subheading>Fields shown after clicking Edit</Subheading>
          <Bullets>
            <li><strong>Title, Campaign, Goal, Caption, and AI Prompt</strong> control the saved wording and instructions.</li>
            <li><strong>Business Focus</strong> identifies Rentals, Facility parties, or Both.</li>
            <li><strong>Media Type</strong> identifies Image or Video.</li>
            <li>
              <strong>Post placement</strong> and <strong>Exact format variant</strong>
              choose the intended location and picture shape. The safe-zone
              guide warns where Facebook or Instagram may trim an image.
            </li>
            <li><strong>Platforms</strong> records Facebook, Instagram, or both.</li>
            <li><strong>Source Image URL</strong> lets you choose or paste a source picture address.</li>
            <li><strong>Generated Media URL</strong> is read-only. It shows where completed generated media is stored.</li>
            <li>
              <strong>Status</strong> can be Draft, Approved, Scheduled, Posted,
              Rejected, or Failed. Choosing Posted only records a status; it does
              not publish the post.
            </li>
            <li><strong>Scheduled Date</strong> and <strong>Scheduled Time</strong> store the plan.</li>
            <li><strong>Save</strong> keeps changes. Title, Caption, AI Prompt, and Media Type must be present.</li>
            <li><strong>Cancel</strong> closes editing without saving the changes currently on screen.</li>
            <li>
              <strong>Regenerate Caption</strong>, <strong>Regenerate Prompt</strong>,
              and <strong>Regenerate Entire Draft</strong> replace the named
              parts. Read the replacement carefully before using it.
            </li>
          </Bullets>

          <Subheading>Director&apos;s Console</Subheading>
          <p>
            Director&apos;s Console appears for Video drafts. It can preview and
            edit the final image or video instructions, choose a different
            existing source picture, select image, motion, and camera presets,
            show safety warnings and estimated generation cost, and start image
            or video generation. A generated image can be accepted, rejected, or
            regenerated. Preview the final instructions before using Generate
            Image or Generate Video. Generation may cost money and may take
            time. The image tools do not appear on an Image draft.
          </p>

          <Subheading>Links at the top of the page</Subheading>
          <p>
            Working context, Publication manifest, Publication scheduler,
            Publication publisher, Publication metrics, Publication ledger,
            Publication learning, Publication execution, Campaign memory, and AI
            Operations Console are advanced pages. Most are read-only inspection
            screens. Publication execution also contains owner-only controls for
            connecting a Meta account, finding and choosing account assets,
            refreshing access, and authorizing or recording future execution
            attempts. These controls are not the normal beginner workflow, and
            there is still no button that publishes a post to Facebook or
            Instagram.
          </p>

          <Subheading>Marketing Memory</Subheading>
          <p>
            The read-only <strong>Marketing Memory</strong> area shows recent and
            current campaigns, promotions, seasonal events, rental categories,
            facility party promotions, media history, approval history, recent
            themes, duplicate warnings, and recommendations. It does not change,
            approve, schedule, generate, or publish a post.
          </p>
        </ManualSection>

        <ManualSection number={4} title="Creating a new post">
          <Steps>
            <li>Open Social Posts and find <strong>Agent social post plan</strong>.</li>
            <li>Choose a <strong>Campaign</strong>, or leave <strong>Custom / no campaign</strong>.</li>
            <li>Choose a prepared <strong>Post goal</strong>. For exact details, choose <strong>Custom goal</strong> and type them.</li>
            <li>For a video, choose an appropriate picture under <strong>Source image URL for video</strong>. Check the preview.</li>
            <li>Choose the intended <strong>Platform</strong>.</li>
            <li>Choose <strong>Video</strong> or <strong>Image</strong> under Media type.</li>
            <li>Choose the correct <strong>Business focus</strong>.</li>
            <li>Click <strong>Create AI Draft</strong> once. Wait for <strong>AI draft created</strong>.</li>
            <li>Find the new card below. It should be marked <strong>Draft</strong>.</li>
            <li>Read the Title, Caption, Prompt, Platforms, and picture carefully.</li>
            <li>Click <strong>Edit</strong>. Correct every name, date, price, link, spelling error, or unsupported promise.</li>
            <li>Click <strong>Save</strong>. Wait for <strong>Draft saved</strong>.</li>
            <li>If the owner&apos;s process requires approval, click <strong>Approve</strong> only after the review is complete.</li>
            <li>Manually copy the checked caption and add it to the correct Facebook or Instagram account.</li>
          </Steps>
        </ManualSection>

        <ManualSection number={5} title="How to write a good AI request">
          <p>
            Choose <strong>Custom goal</strong> when the prepared goals are not
            specific enough. Write short, concrete facts. The tool does not have
            a separate Tone, Price, Date, Audience, or Call to action box, so put
            those confirmed details in Custom goal.
          </p>
          <Subheading>Include these facts when they are known and confirmed</Subheading>
          <Bullets>
            <li>The exact rental, event, or package name.</li>
            <li>The confirmed price, if a price should appear.</li>
            <li>The confirmed available date.</li>
            <li>The correct city or service area.</li>
            <li>The audience, such as families, churches, schools, or daycares.</li>
            <li>The action you want readers to take, such as call or visit the booking page.</li>
            <li>Important restrictions, the approved phone number, and the approved booking link.</li>
            <li>Whether availability is limited, but only after checking it.</li>
          </Bullets>
          <Subheading>Safe example requests</Subheading>
          <Bullets>
            <li>&ldquo;Promote [confirmed water slide name] for [confirmed date]. Ask families to check the booking page. Do not add a price or discount.&rdquo;</li>
            <li>&ldquo;Promote facility birthday parties for families. Use a warm, helpful tone. Do not state a price or promise availability.&rdquo;</li>
            <li>&ldquo;Announce confirmed weekend availability for [rental name] on [date]. Say availability is limited only if the owner confirmed that.&rdquo;</li>
            <li>&ldquo;Create a holiday booking reminder. Encourage customers to book early. Do not invent a holiday discount.&rdquo;</li>
            <li>&ldquo;Announce the new inflatable [exact name]. Use only confirmed details and do not guess its size or features.&rdquo;</li>
            <li>&ldquo;Create a rainy-day facility party post. Do not promise specific openings or prices.&rdquo;</li>
            <li>&ldquo;Promote a last-minute opening for [exact item or party type] on [confirmed date].&rdquo;</li>
          </Bullets>
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <strong>Never ask the tool to guess.</strong> It must not invent
            prices, availability, discounts, dates, policies, rental
            specifications, safety promises, or service areas.
          </div>
        </ManualSection>

        <ManualSection number={6} title="Reviewing an AI-generated post">
          <p>Before saving or publishing, check every item below:</p>
          <Bullets>
            <li>The business name says Jumping Jax correctly.</li>
            <li>The rental or party package name is exact.</li>
            <li>Every price, date, and statement of availability is confirmed.</li>
            <li>The phone number and website link are correct.</li>
            <li>Spelling and grammar are clear and professional.</li>
            <li>The wording is appropriate for families and the chosen platform.</li>
            <li>The post does not promise weather, safety, delivery, availability, or results that the business cannot guarantee.</li>
          </Bullets>
          <Subheading>How to correct the caption</Subheading>
          <Steps>
            <li>Click <strong>Edit</strong> on the draft card.</li>
            <li>Click inside the box labeled <strong>Caption</strong>.</li>
            <li>Remove incorrect words and type the correct information.</li>
            <li>Also review <strong>Title</strong>, <strong>Goal</strong>, and <strong>AI Prompt</strong>.</li>
            <li>Click <strong>Save</strong> and wait for <strong>Draft saved</strong>.</li>
          </Steps>
        </ManualSection>

        <ManualSection number={7} title="Saving, copying, scheduling, and publishing">
          <Bullets>
            <li><strong>Saving a draft:</strong> Click Edit, make changes, then click Save. This keeps the draft inside Social Posts.</li>
            <li><strong>Copying a caption:</strong> There is no Copy Caption button. Open Edit, click in Caption, select the text, and copy it. On Windows, press Ctrl+A while in the Caption box, then Ctrl+C. On a phone, press and hold the text and choose Select All, then Copy.</li>
            <li><strong>Copying a prompt:</strong> Copy Prompt and Copy Image Prompt copy creation instructions, not the finished caption.</li>
            <li><strong>Downloading:</strong> The main page has no finished-post download button. Handle the caption and image separately.</li>
            <li><strong>Approving:</strong> Approve records that a draft was accepted. It does not publish.</li>
            <li><strong>Scheduling:</strong> Choose a date and time and click Schedule. This records the plan and changes the status to Scheduled. It does not automatically post later.</li>
            <li><strong>Posted status:</strong> Staff can choose Posted while editing to record work completed elsewhere. The status itself does not send anything.</li>
          </Bullets>
          <Subheading>Manual Facebook or Instagram steps</Subheading>
          <Steps>
            <li>Review and save the finished draft.</li>
            <li>Copy the Caption from the Edit area.</li>
            <li>Open the correct Jumping Jax Facebook or Instagram account.</li>
            <li>Start a new post in that social media service.</li>
            <li>Paste the caption.</li>
            <li>Add the reviewed image or video separately.</li>
            <li>Check the account, caption, media, date, and audience one final time.</li>
            <li>Use the social media service&apos;s own Publish or Schedule button.</li>
            <li>Return to Social Posts and change the saved status to Posted if that is the owner&apos;s process.</li>
          </Steps>
        </ManualSection>

        <ManualSection number={8} title="Images and videos">
          <Bullets>
            <li><strong>Select an existing image:</strong> Use the source-image list in Agent social post plan, Edit, or Director&apos;s Console on a Video draft.</li>
            <li><strong>Use another hosted image:</strong> Paste its public web address into the source image URL box.</li>
            <li><strong>Upload an image:</strong> There is no direct upload button on the Social Posts page.</li>
            <li><strong>Generate images:</strong> On a Video draft, open Director&apos;s Console and then Image Director. Review the prompt and estimated cost before clicking Generate Image.</li>
            <li><strong>Accept, reject, or regenerate:</strong> Review the generated image preview and verification message. Accept Image makes it the source for video creation; Reject Image removes that generated choice; Regenerate tries again.</li>
            <li><strong>Remove a source image:</strong> Click Edit, clear the Source Image URL box, and save.</li>
            <li><strong>Generate a video:</strong> On a Video draft, open Director&apos;s Console, preview the final prompt, review warnings, then use Generate Video when enabled.</li>
            <li><strong>Download:</strong> Social Posts does not provide a dedicated Download Image button. Do not assume copying the caption also copies the image.</li>
          </Bullets>
          <Subheading>Image review</Subheading>
          <Bullets>
            <li>Make sure the inflatable, facility, and setup are represented accurately.</li>
            <li>Reject any image showing unsafe behavior or a misleading setup.</li>
            <li>Check for incorrect words, prices, logos, or signs inside the picture.</li>
            <li>Do not show private customer information.</li>
            <li>Use customer photos only when Jumping Jax has permission.</li>
          </Bullets>
        </ManualSection>

        <ManualSection number={9} title="Finding and managing previous posts">
          <p>
            Saved posts appear as cards below the creation forms, with the newest
            posts first. The main page does not currently have a Search or Filter
            box.
          </p>
          <Bullets>
            <li>Look for the title, media preview, status badge, platform, and scheduled date.</li>
            <li>Click Edit to open and change a saved draft.</li>
            <li>Click Duplicate to create a reusable copy as a new Draft.</li>
            <li>Click Delete and confirm only when the draft should be permanently removed.</li>
            <li>Use Approve, Reject, Schedule, or the Status list to record the current stage.</li>
            <li>Draft, Approved, Scheduled, Posted, Rejected, and Failed are saved labels. They do not prove that a post appeared on social media.</li>
          </Bullets>
        </ManualSection>

        <ManualSection number={10} title="Marketing Memory and campaign guidance">
          <p>
            Campaigns are prepared themes such as Summer Water Slides, Birthday
            Parties, Backyard Fun, Beat the Heat, Church Events, Schools &amp;
            Daycares, Toddler Fun, Last-Minute Availability, New Inventory, and
            Private Parties. Choosing one guides future draft wording, focus, and
            suggested image. It does not change an older saved post.
          </p>
          <p className="mt-3">
            Marketing Memory summarizes saved post history. It shows what has
            recently been used and may show duplicate warnings or
            recommendations. It is read-only on this page. Staff cannot type
            prices, policies, or business details into Marketing Memory here.
            Correct a draft directly with Edit.
          </p>
          <p className="mt-3">
            Keep every confirmed business detail in the final Caption accurate.
            An old campaign or old post may contain information that is no longer
            current.
          </p>
        </ManualSection>

        <ManualSection number={11} title="Common example workflows">
          <Subheading>Weekend water slide availability</Subheading>
          <p>
            Choose the <strong>Summer Water Slides</strong> or
            <strong> Last-Minute Availability</strong> Campaign. Choose
            <strong> Custom goal</strong> and type the exact confirmed slide name
            and date. Choose Rentals and the intended platform. Select the
            correct slide image, create the draft, then verify availability
            before saving or publishing.
          </p>
          <Subheading>Facility birthday party promotion</Subheading>
          <p>
            Choose <strong>Birthday Parties</strong> or
            <strong> Private Parties</strong>. Choose Facility parties as the
            Business focus when a campaign has not already set the focus. Ask
            for a general promotion without a price or open time unless both are
            confirmed.
          </p>
          <Subheading>Holiday booking reminder</Subheading>
          <p>
            Leave Campaign at Custom / no campaign. Choose Custom goal and ask
            customers to book early for the named holiday. Do not mention a
            discount, deadline, or opening unless the owner confirmed it.
          </p>
          <Subheading>New rental announcement</Subheading>
          <p>
            Choose <strong>New Inventory</strong>. In Custom goal, type the exact
            rental name and only its confirmed features. Choose the real product
            picture, then check that generated wording and media match the item.
          </p>
          <Subheading>Church, school, or daycare post</Subheading>
          <p>
            Choose <strong>Church Events</strong> or
            <strong> Schools &amp; Daycares</strong>. Enter the intended audience
            and approved action in Custom goal. Do not promise capacity, service
            area, price, or availability unless confirmed.
          </p>
        </ManualSection>

        <ManualSection number={12} title="Common problems and solutions">
          <Bullets>
            <li><strong>Create AI Draft does nothing:</strong> Wait briefly and look for a red error message. Make sure Custom goal is not blank when Custom goal is selected. Do not click repeatedly. If the error remains, copy your wording somewhere safe and contact the owner.</li>
            <li><strong>A required field is missing:</strong> When saving a manual or edited draft, fill in Title, Caption, AI Prompt, and Media Type.</li>
            <li><strong>The generated post is incorrect:</strong> Click Edit, correct the Caption and other fields, then Save. Do not publish the incorrect version.</li>
            <li><strong>A post was not saved:</strong> Look for Draft saved or another success message. If you see an error, copy your work somewhere safe before refreshing.</li>
            <li><strong>The image did not appear:</strong> Check that a source image was selected and its preview works. A pasted picture address must be public. If generation says Processing, wait before refreshing.</li>
            <li><strong>You cannot find a previous post:</strong> Scroll below the creation forms and look through the cards. There is no search box. The post may have been deleted or may have failed to load.</li>
            <li><strong>The post is still Draft:</strong> Save does not approve it. After a full review, use Approve only if the owner&apos;s process allows you to do so.</li>
            <li><strong>The post did not appear on Facebook:</strong> This is expected if it was only Saved, Approved, or Scheduled here. Open Facebook or Instagram and publish it manually.</li>
            <li><strong>The page looks out of date:</strong> First copy unsaved words somewhere safe. Then refresh once. Refreshing reloads saved information, but it cannot fix every service problem.</li>
            <li><strong>Internet access was lost or the page closed:</strong> Unsaved typing may be lost. Reopen Social Posts and check the saved cards. Only work followed by a successful save message should be expected to remain.</li>
            <li><strong>You cannot open the page:</strong> Sign in again. If access is still refused, contact the owner; do not try another person&apos;s login.</li>
            <li><strong>A button says Rate-limited or Failed:</strong> Stop and read the message. Wait for the stated retry time if one is shown. Contact the owner if it continues.</li>
          </Bullets>
        </ManualSection>

        <ManualSection number={13} title="Safety and accuracy reminders">
          <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-rose-950">
            <Bullets>
              <li>AI-generated content must be reviewed by a person.</li>
              <li>Do not publish invented prices, availability, dates, discounts, policies, or specifications.</li>
              <li>Do not include customer names, phone numbers, addresses, or private booking information.</li>
              <li>Do not promise a rental is available without checking the booking system.</li>
              <li>Do not publish discounts unless the owner approved them.</li>
              <li>Do not upload or use customer photos without permission.</li>
              <li>Do not assume Save, Approve, Schedule, or Posted sends anything to social media.</li>
              <li>Contact the owner whenever you are unsure.</li>
            </Bullets>
          </div>
        </ManualSection>

        <ManualSection number={14} title="Quick-reference checklist">
          <p className="font-black text-slate-950">Before publishing:</p>
          <ul className="mt-3 space-y-2">
            {[
              "Confirm the rental, event, or package name.",
              "Confirm the price, or remove it.",
              "Confirm the date and availability.",
              "Confirm the phone number and website link.",
              "Review the image or video.",
              "Remove private customer information.",
              "Check spelling and wording.",
              "Confirm the desired social platform and correct business account.",
              "Make sure the post was actually published in Facebook or Instagram.",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="text-lg text-emerald-700">
                  □
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </ManualSection>
      </div>
    </section>
  );
}
