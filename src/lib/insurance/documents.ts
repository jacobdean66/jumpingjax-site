export const DOCUMENTS = [
  { id: "loss-runs", title: "Currently valued loss runs", kind: "external", description: "Current policy period and three prior years, supplied by your insurers.", needs: "Obtain carrier-issued reports with a current valuation date for all four periods." },
  { id: "facility-diagram", title: "Facility diagram", kind: "draft", description: "A layout worksheet and a place for the verified floor plan.", needs: "Add the actual floor plan, dimensions, exits, equipment locations and outdoor assembly point." },
  { id: "training-manual", title: "Employee training manual", kind: "draft", description: "Opening, guest supervision, rental setup, incident response and training sign-off.", needs: "Confirm staffing, equipment-specific instructions and staff responsibilities before adopting." },
  { id: "evacuation-plan", title: "Emergency evacuation plan", kind: "draft", description: "Reporting, evacuation, guest accountability and emergency staff roles.", needs: "Verify exits, routes, alarm method, staff assignments, assistance needs and meeting point onsite." },
  { id: "safety-rules", title: "Rules & safety guidelines", kind: "draft", description: "Indoor play and rental rules in one printable document.", needs: "Check against equipment manuals and your actual operating procedures; approve before posting." },
  { id: "waiver-release", title: "Waiver / release forms", kind: "live", description: "Copies of the current indoor waiver and rental agreement from the website.", needs: "Have the insurer confirm the rental agreement meets its requested rental release requirement." },
  { id: "equipment-schedule", title: "Rental equipment schedule", kind: "inventory", description: "Inventory descriptions with editable insurance details and a spreadsheet download.", needs: "Confirm owned units, quantities, manufacturer, model, serial number, year, condition and replacement value." },
] as const;
export type DocumentId = typeof DOCUMENTS[number]["id"];
export type EquipmentRow = { item: string; category: string; quantity: string; manufacturer: string; model: string; serial: string; year: string; length: string; width: string; height: string; dimensionUnit: string; replacementValue: string; condition: string };
export const EQUIPMENT_COLUMNS: { key: keyof EquipmentRow; label: string }[] = [
  { key: "manufacturer", label: "Manufacturer" }, { key: "category", label: "Type" }, { key: "item", label: "Item name" },
  { key: "year", label: "Year made" }, { key: "serial", label: "Serial numbers / asset ID" },
  { key: "length", label: "Length" }, { key: "width", label: "Width" }, { key: "height", label: "Height" }, { key: "dimensionUnit", label: "Dimension units" },
  { key: "replacementValue", label: "Replacement value (USD / unit)" }, { key: "quantity", label: "Qty" }, { key: "model", label: "Model" }, { key: "condition", label: "Condition / notes" },
];
export type SavedDocument = { text: string; equipment: EquipmentRow[]; reviewed: boolean; updatedAt: string | null; updatedBy: string | null };
export type Attachment = { path: string; name: string; size: number; createdAt: string };
export type DocumentRecord = SavedDocument & { id: DocumentId; attachments: Attachment[]; legalHtml?: string; sourceError?: string; sourceLabel?: string };
export function isDocumentId(value: string): value is DocumentId { return DOCUMENTS.some(d => d.id === value); }
export function emptyEquipmentRow(): EquipmentRow { return { item: "", category: "", quantity: "", manufacturer: "", model: "", serial: "", year: "", length: "", width: "", height: "", dimensionUnit: "", replacementValue: "", condition: "" }; }

// These are proposed procedures, not a claim about the business's current practices.
export const DRAFT_TEXT: Record<DocumentId, string> = {
  "loss-runs": `LOSS RUN REQUEST WORKSHEET

Business / named insured: Jumping Jax — confirm the exact legal name on each policy.
Business address: 559 Beaudrot Rd, Greenwood, SC — confirm against policy records.

Requested reports: current policy period plus the three prior years.
For each period record: insurer; policy number; effective and expiration dates; report valuation date; date received.

Current period: [carrier / policy / dates / valuation date]
Prior year 1: [carrier / policy / dates / valuation date]
Prior year 2: [carrier / policy / dates / valuation date]
Prior year 3: [carrier / policy / dates / valuation date]

REQUEST TEXT
Please provide currently valued loss runs for our current policy period and the three prior years, including claim detail, paid amounts, reserves, claim status and the valuation date. Where there were no reported claims, please provide the carrier's confirmation. Please include policies for both the indoor center and rental operations where applicable.

COMPLETION CHECK
Match all four periods to the insurer's request. Include prior carriers when coverage changed. Ask the broker what documentation is acceptable for any period when the business was not operating or had no coverage. Do not replace carrier records with a self-created no-loss statement.

This worksheet is not a loss run report. Attach the actual carrier-issued reports here.`,
  "facility-diagram": `FACILITY DIAGRAM — VERIFICATION WORKSHEET

Facility: Jumping Jax, 559 Beaudrot Rd, Greenwood, SC.
Prepared by: [name]   Site visit date: [date]   Drawing revision: [revision]

The actual layout has not been supplied. This worksheet is not a floor plan or an evacuation map. Attach a measured drawing, existing building plan or clearly labeled sketch after checking it onsite.

DRAWING CHECKLIST
• Show the building outline, approximate dimensions and north orientation.
• Identify entrance / check-in, play zones, party rooms, restrooms, storage and staff areas where present.
• Identify each actual exit and route; show direction arrows and any accessible routes.
• Mark each inflatable / attraction footprint, clearances and supervision positions.
• Mark verified alarm points, extinguishers, first-aid supplies, electrical / blower areas and utility shutoffs where applicable.
• Mark exterior assembly point and emergency responder access, away from traffic and hazards.
• Identify any plan scale; label an unmeasured sketch “not to scale.”

AREA / EXIT REGISTER
Area: [name] | Equipment / use: [details] | Exit route: [verified route]
Area: [name] | Equipment / use: [details] | Exit route: [verified route]
Area: [name] | Equipment / use: [details] | Exit route: [verified route]

Outdoor assembly point: [verified location]
Alternate assembly point: [verified location]
Occupancy limits: [approved limits / source; do not estimate]

Owner verification: [name / date]
Coordinate the completed drawing with the evacuation plan.`,
  "training-manual": `EMPLOYEE TRAINING MANUAL — PROPOSED PROCEDURES

Applies to indoor play, facility parties, inflatable rentals, foam activities and supporting equipment as applicable. Owner must tailor and approve these procedures before use. Equipment manuals and confirmed site procedures control equipment-specific limits.

1. STAFF RESPONSIBILITIES
Owner / manager: [name / contact]. Shift lead: [assigned each shift]. Emergency coordinator: [assigned each shift]. Assign check-in, play supervision and rental setup duties before opening. Record required training for each attraction and task. Do not assign equipment operations to someone who has not demonstrated competence. Establish staffing for each attraction from manufacturer instructions and actual sightlines; assign additional attendants where blind spots or crowding require them.

2. BEFORE OPENING
Walk all used areas and confirm exit routes are clear and doors usable. Inspect equipment, anchoring, inflation, seams, barriers, mats, cords and blower protection against the unit's manual. Check restrooms and floors for slip hazards. Locate first-aid supplies, emergency contacts and alarm equipment. Remove suspect equipment from service and notify the lead. Record the opening inspection, including issues and corrective action.

3. WAIVERS AND CHECK-IN
Use the website's current waiver workflow. Check that each participant is covered and each adult has completed their own agreement. Verify parent / legal guardian linkage for children. Search existing records before creating duplicates. Record the people who actually arrive, then group those paying together on one checkout ticket. Assign any accepted free pass to its specific recipient and record cash / card collected. A free pass does not replace the waiver. Do not bypass missing or expired agreements.

4. SUPERVISION AND GUEST RULES
Explain posted rules before play. Keep a clear view of riders and avoid blind spots. Separate incompatible age / size groups and enforce each unit's posted limits. Stop rough play, flips, climbing exterior walls, crowding and misuse. Keep exits and slide landing zones clear. Remove unsafe participants from the activity and ask the lead for help. Do not leave an operating attraction unattended.

5. RENTAL SETUP AND HANDOVER
Review the booking, equipment and approved setup site. Follow the unit's manual for anchoring, ballast, blower use, clearances, electrical supply and occupancy. Do not invent substitute anchoring or operate without the instructions needed for safe setup. Inspect before handover. Explain supervision, capacity, use restrictions, weather monitoring and shutdown steps to the responsible adult. Record setup inspection and customer handover. Complete the existing rental agreement process. Never treat rental fees as equipment replacement values.

6. WEATHER AND POWER LOSS
Use the unit-specific manufacturer limits for sustained wind and gusts; monitor conditions during outdoor use. Stop play and evacuate equipment for unsafe weather, loss of inflation, power failure, equipment movement or suspected damage. Follow manufacturer instructions for safe shutdown. Assign a staff member to keep others away. Restart only after the lead verifies the hazard is resolved and the equipment passes inspection.

7. FOAM, WATER AND OTHER EQUIPMENT
Follow the product instructions, safety data sheets and equipment manuals for solution use, electrical placement, surfaces and supervision. Address slippery surfaces and keep children within supervised areas. Use only approved products. Record equipment-specific training separately. Do not assume inflatable procedures cover all other attractions.

8. EMERGENCIES AND INCIDENTS
Call 911 when emergency assistance is needed. State the facility address or rental event location, the emergency and access details. Follow the site-specific evacuation plan. Staff provide first aid only within their training. Stop the affected activity, secure the area and inform the owner. Record time, location, equipment, witnesses, factual observations and actions taken in the incident / damage log. Preserve relevant records and photographs according to owner procedures. Do not speculate about fault or promise insurance coverage.

9. CLEANING, CLOSE AND RECORDS
Clean and disinfect using product instructions and required contact times. Dry and store equipment as its manual requires. Secure supplies, electrical equipment and premises. Record damage, maintenance needs and unresolved hazards for the next shift. Preserve waiver, inspection, training, handover and incident records under the owner's retention policy: [policy / location].

10. PRACTICAL TRAINING SIGN-OFF
Employee: [name]   Trainer: [name]   Date: [date]
Demonstrated: opening inspection; waiver/check-in; guest supervision; unit-specific setup and anchoring; customer handover; weather / power shutdown; evacuation route and assembly point; incident reporting; cleaning and close.
Equipment / task trained: [specific units and tasks]
Restrictions / retraining required: [details]
Employee signature: __________________   Trainer signature: __________________
Refresher / drill schedule: [owner-approved schedule]. Review training when duties, equipment or procedures change.

REFERENCE
Use the CPSC Inflatable Amusement Devices bulletin alongside each manufacturer manual: https://www.cpsc.gov/Safety-Education/Safety-Guides/Kids-and-Babies-Outdoors-and-Garden/Amusement-Ride-Safety-Bulletin-Inflatable-Amusement-Devices-Residential-and-Commercial-Guidance`,
  "evacuation-plan": `EMERGENCY EVACUATION PLAN — SITE DETAILS REQUIRED

Facility: Jumping Jax, 559 Beaudrot Rd, Greenwood, SC.
Business phone: 864-933-1420. Emergency assistance: 911.
Owner / coordinator: [name / contact]. Alternate: [name / contact].
This plan is a draft until routes, alarm method, assembly location and staff assignments are checked onsite. It does not establish code compliance or approved occupancy.

1. REPORT AND ALERT
Anyone discovering fire, smoke or another immediate danger alerts the shift lead and calls 911 when needed. Give the actual location, type of emergency, number of people at risk and responder access point. Facility alarm / announcement method: [verified method]. The lead communicates the need to evacuate clearly to guests and staff.

2. STOP PLAY AND LEAVE
Stop admissions and play. Guide guests to the nearest safe verified exit; do not use a route affected by smoke or another hazard. Leave belongings behind. Keep groups moving calmly. No staff member stays behind to operate critical equipment under this proposed plan. Staff do not delay evacuation to unplug blowers, collect payments or retrieve records. Any shutdown duty must be separately assessed, documented and trained before adoption.

3. EXIT ROUTE ASSIGNMENTS — COMPLETE FROM VERIFIED DIAGRAM
Play area: primary [route / exit]; alternate [route / exit]; assigned staff [role].
Party rooms: primary [route / exit]; alternate [route / exit]; assigned staff [role].
Restrooms / storage / other used areas: [routes and assigned staff].
Assistance for guests with mobility, sensory or other support needs: [method / trained staff / accessible route]. Staff direct responders to anyone unable to leave; they do not enter an unsafe area or attempt an untrained rescue.

4. ASSEMBLY AND ACCOUNTABILITY
Primary outdoor meeting point: [verified place away from building, traffic and emergency access].
Alternate meeting point: [verified place].
Accountability lead: [name / role]. Use staff roster and available attendance / party guest records to account for people, without delaying departure to obtain those records. Ask guardians and party hosts to identify missing guests. Give responders names and last known locations. Keep children with their actual guardians where possible; do not release a child to an unknown person. Report missing people to responders; do not re-enter to search.

5. MEDICAL AND FIRE RESPONSE
First-aid supply location: [verified location]. AED location, if present: [verified location]. Staff provide care only within current training. Under this proposed plan, staff evacuate and leave firefighting / rescue to emergency responders. Any designated extinguisher use requires a separately documented policy and appropriate training.

6. OTHER EMERGENCIES
For severe weather, follow the verified shelter plan: [safe shelter location / weather alert method / assigned lead]. Outdoor assembly may be unsafe during severe weather. For chemical release or another event requiring shelter indoors, follow emergency responder instructions and the site's assessed shelter procedures. For rental sites, confirm event address, local exits / shelter, responsible adult and emergency contact at handover.

7. RE-ENTRY AND FOLLOW-UP
Only re-enter after emergency responders authorize it. Do not restart affected equipment until inspected and released by the responsible manager. Notify the owner, document the incident and preserve records. Review the plan after an incident, drill or layout change.

8. TRAINING AND APPROVAL
Walk the actual routes with staff, demonstrate the alarm method and practice accountability at the assembly point. Confirm routes and assistance arrangements during a site review. Record drill date, participants, issues and corrective actions. Review roles with new staff and whenever responsibilities or the plan change.
Site verification completed by: [name / date]
Owner approval / effective date: [name / date]
Next review / drill: [date]

REFERENCE
Planning framework: OSHA Emergency Action Plan guidance, https://www.osha.gov/etools/evacuation-plans-procedures/eap . Verify applicability and site requirements with the appropriate local authority.`,
  "safety-rules": `RULES & SAFETY GUIDELINES — OWNER REVIEW DRAFT

INDOOR PLAY AND FACILITY PARTIES
• Complete the current waiver before participating. Each adult signs their own agreement; a child's actual parent or legal guardian signs for that child.
• Follow staff directions and the posted age, size, weight and occupancy limits for each attraction.
• Responsible adults supervise their children. Staff supervision does not replace the guardian's responsibilities.
• Remove footwear and loose or sharp items as directed for the equipment. Keep food, drinks and gum outside play equipment.
• No flips, rough play, wrestling, pushing, climbing exterior walls or intentional collisions.
• Use slides as directed; wait until the landing area is clear before the next rider.
• Separate incompatible size / age groups. Do not enter equipment that staff have closed.
• Keep exits, walkways, cords, blowers and equipment access clear. Tell staff about spills, damaged equipment or injuries immediately.
• Do not participate while impaired or contrary to applicable health restrictions. Staff may stop unsafe activity and remove a participant from play.

RENTALS AND OUTDOOR USE
• Use the equipment only as trained and within its manufacturer instructions. The responsible adult maintains supervision throughout use.
• Follow the manufacturer's anchoring and ballast instructions for the actual surface; do not move the equipment or remove anchors after setup.
• Enforce unit-specific capacity and rider limits. Keep slide exits and blower areas clear.
• Monitor weather and gusts. Stop use at the equipment manufacturer's weather limits or earlier when conditions become unsafe; follow the supplied shutdown procedure.
• Stop play and clear the equipment for power loss, loss of inflation, movement or suspected damage. Keep guests away and contact Jumping Jax before reuse.
• Follow product instructions for foam solution, water use and electrical separation. Prevent unsupervised access to water and slippery areas.
• Report incidents, damage and equipment problems promptly. Follow the current rental agreement and the handover instructions for your specific unit.

STAFF OPENING / HANDOVER CHECK
Date / location: [details]   Inspector: [name]   Equipment: [unit IDs]
Check: manufacturer instructions available; approved setup / clearances; anchoring; inflation; seams / surfaces; electrical / blower protection; exits / landing zones; supervision assignments; weather monitoring; customer instructions; emergency contacts.
Result / corrective actions: [details]
Equipment taken out of service: [details]

Unit-specific rider limits, wind limits, anchoring and staffing must be confirmed from the actual manuals. These proposed rules are not evidence that inspections or training have occurred.
Owner approved by: [name]   Effective date: [date]

REFERENCE
CPSC Inflatable Amusement Devices safety guidance: https://www.cpsc.gov/Safety-Education/Safety-Guides/Kids-and-Babies-Outdoors-and-Garden/Amusement-Ride-Safety-Bulletin-Inflatable-Amusement-Devices-Residential-and-Commercial-Guidance`,
  "waiver-release": `CURRENT FORMS — INSURANCE REVIEW COPIES

The indoor waiver and rental agreement below are loaded from the website's current templates. These copies contain no customer signatures or private participant records. They do not change the live signing workflow.

Indoor center: adults sign their own agreement; children are linked to the actual signing parent / legal guardian. The live workflow records the covered people, signatures, acknowledgments and waiver version.

Rentals: the rental agreement is presented with booking-specific equipment, event details, pricing and signature acknowledgment. The copy here provides its current terms for insurer review. Ask the insurer whether it requires a separate rental participant release. Do not assume the rental agreement satisfies that requirement.

Existing signing paths: /waiver and the customer-specific rental agreement link generated for each rental booking.`,
  "equipment-schedule": `RENTAL EQUIPMENT SCHEDULE — VERIFY PHYSICAL ASSETS

The initial equipment names and categories come from rental inventory. Catalog entries are not verified physical unit counts. Inactive inventory is included so the owner can decide which owned equipment to insure. Add separate rows for individual serial-numbered units or equipment missing from inventory.

Complete quantity, manufacturer, model, serial / asset ID, year, length, width, height, dimension units, per-unit replacement value in USD and condition. The core columns follow the insurer's Equipment inventory worksheet. Confirm dimensions against the actual unit or its manufacturer records. Use actual replacement values; website rental prices are not replacement values. Remove entries that are not owned rental equipment. Include blowers, generators, foam equipment and supporting assets as the insurer requires.

Named insured: [exact policy name]
Storage / operating location: [address]
Valuation date: [date]
Prepared / verified by: [name / date]`,
};

export function validateSavedDocument(value: unknown): Omit<SavedDocument, "updatedAt" | "updatedBy"> {
  if (!value || typeof value !== "object") throw new Error("Invalid document.");
  const v = value as Record<string, unknown>;
  if (typeof v.text !== "string" || v.text.length > 80000 || typeof v.reviewed !== "boolean" || !Array.isArray(v.equipment) || v.equipment.length > 300) throw new Error("Document is too large or invalid.");
  const equipment = v.equipment.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("Invalid equipment row.");
    const clean = emptyEquipmentRow();
    for (const { key } of EQUIPMENT_COLUMNS) {
      const field = (row as Record<string, unknown>)[key] ?? (["length", "width", "height", "dimensionUnit"].includes(key) ? "" : undefined);
      if (typeof field !== "string" || field.length > 500) throw new Error("Invalid equipment field.");
      clean[key] = field;
    }
    return clean;
  });
  return { text: v.text, reviewed: v.reviewed, equipment };
}
export function equipmentCsv(rows: EquipmentRow[]): string {
  // Neutralize spreadsheet formulas while preserving real text and quoted commas.
  const cell = (value: string) => `"${(/^[\s]*[=+\-@\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  return [EQUIPMENT_COLUMNS.map(c => cell(c.label)).join(","), ...rows.map(r => EQUIPMENT_COLUMNS.map(c => cell(r[c.key])).join(","))].join("\r\n");
}
export function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
export const DOCUMENT_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export function renderDocument(record: DocumentRecord): string {
  const definition = DOCUMENTS.find(d => d.id === record.id)!;
  const printColumns = EQUIPMENT_COLUMNS.filter(c => c.key !== "condition" && c.key !== "model");
  const table = record.id === "equipment-schedule" ? `<style>@page{size:letter landscape;margin:0.5in}table{font-size:10px}</style><p>The spreadsheet download also includes model and per-row source / condition notes.</p><div class="wide"><table><thead><tr>${printColumns.map(c => `<th>${escapeHtml(c.label)}</th>`).join("")}</tr></thead><tbody>${record.equipment.map(r => `<tr>${printColumns.map(c => `<td>${escapeHtml(r[c.key] || "To verify")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "";
  const status = record.reviewed ? "Owner marked reviewed" : definition.kind === "live" && !record.sourceError ? "Current template copies — insurer review required" : "DRAFT / INCOMPLETE — review and verification required";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${DOCUMENT_CSP}"><title>Jumping Jax — ${escapeHtml(definition.title)}</title><style>body{font:15px/1.6 Arial,sans-serif;color:#18283a;max-width:1000px;margin:36px auto;padding:0 24px}h1{font-size:28px;line-height:1.2}h2{font-size:21px}header{border-bottom:3px solid #075985;margin-bottom:24px}small{font-size:12px}.status{background:#fff6dc;border:1px solid #d5ab49;padding:12px}.text{white-space:pre-wrap;overflow-wrap:anywhere}.toolbar{padding:12px;background:#e8f5ff}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #a7b7c6;padding:7px;text-align:left;overflow-wrap:anywhere}th{background:#e8f0f6}tr{break-inside:avoid}.wide{overflow-x:auto}footer{border-top:1px solid #bbb;margin-top:30px;font-size:12px}@media print{body{margin:0;padding:0;max-width:none}.toolbar{display:none}.wide{overflow:visible}thead{display:table-header-group}}@page{size:letter;margin:0.65in}</style></head><body><p class="toolbar">Use your browser's Print command to print or save as PDF. Attached originals are separate files in the insurance packet.</p><header><small>JUMPING JAX · INSURANCE & SAFETY DOCUMENTS</small><h1>${escapeHtml(definition.title)}</h1></header><p class="status">${escapeHtml(status)}${record.sourceError ? " · " + escapeHtml(record.sourceError) : ""}</p><p><strong>Still to confirm:</strong> ${escapeHtml(definition.needs)}</p><div class="text">${escapeHtml(record.text)}</div>${table}${record.legalHtml ?? ""}<footer><p>${escapeHtml(record.sourceLabel ?? "Proposed document; verify against actual operations.")}</p><p>Last saved: ${escapeHtml(record.updatedAt ?? "Not yet saved")} · By: ${escapeHtml(record.updatedBy ?? "Not yet reviewed")}</p><p>Attached originals: ${record.attachments.map(a => escapeHtml(a.name)).join(", ") || "None"}</p></footer></body></html>`;
}
