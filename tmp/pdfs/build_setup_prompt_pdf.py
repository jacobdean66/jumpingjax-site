from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


OUTPUT = "output/pdf/jumping-jax-laptop-setup-prompt.pdf"

prompt = """I need you to help me get fully set up to work on this GitHub project:

https://github.com/jacobdean66/jumpingjax-site

Act like a setup assistant and keep going step by step until my laptop is ready. Do not assume anything is installed. Check what I have, explain only what I need to do, and wait for me when I need to click, sign in, download, or approve something.

Your goals:

1. Check whether I have Git installed.
2. Check whether I have Node.js installed.
3. Help me install Git, Node.js, and VS Code if needed.
4. Help me create or sign into a GitHub account.
5. Ask me for my GitHub username.
6. Stop and tell me to send this exact message to Jacob:

"Please invite my GitHub account to the Jumping Jax repo. My GitHub username is: [MY USERNAME]"

7. Wait until I confirm Jacob invited me and I accepted the GitHub invite.
8. Help me clone this repo:
   https://github.com/jacobdean66/jumpingjax-site
9. Help me open the project.
10. Help me install dependencies.
11. Help me run the site locally.
12. Help me create a test branch so I can safely make changes.
13. Confirm everything works.

Important rules:

- Keep looping until setup is complete.
- At the end of every message, either give me the next exact step or ask me one question.
- Do not skip ahead.
- Do not ask me to paste passwords, tokens, secret keys, or private .env values into chat.
- If the project needs environment variables, tell me to ask Jacob for the .env file or values privately.
- If something fails, diagnose it and give me the next fix.
- When setup is complete, give me a short summary of what was installed, where the project folder is, and the commands I should use next time.

Start by asking me what kind of laptop I am using: Windows or Mac."""


def para(text, style):
    return Paragraph(text.replace("\n", "<br/>"), style)


styles = getSampleStyleSheet()
title = ParagraphStyle(
    "Title",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=22,
    leading=26,
    textColor=colors.HexColor("#1f2937"),
    spaceAfter=14,
)
subtitle = ParagraphStyle(
    "Subtitle",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=11,
    leading=15,
    textColor=colors.HexColor("#4b5563"),
    spaceAfter=18,
)
section = ParagraphStyle(
    "Section",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=13,
    leading=16,
    textColor=colors.HexColor("#111827"),
    spaceBefore=10,
    spaceAfter=8,
)
body = ParagraphStyle(
    "Body",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=10.5,
    leading=14,
    textColor=colors.HexColor("#111827"),
)
code = ParagraphStyle(
    "Code",
    parent=styles["Code"],
    fontName="Courier",
    fontSize=8.5,
    leading=11.5,
    leftIndent=12,
    rightIndent=12,
    borderColor=colors.HexColor("#d1d5db"),
    borderWidth=0.75,
    borderPadding=8,
    backColor=colors.HexColor("#f9fafb"),
    textColor=colors.HexColor("#111827"),
)

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=letter,
    rightMargin=0.65 * inch,
    leftMargin=0.65 * inch,
    topMargin=0.6 * inch,
    bottomMargin=0.6 * inch,
    title="Jumping Jax Laptop Setup Prompt",
)

story = [
    Paragraph("Jumping Jax Laptop Setup Prompt", title),
    Paragraph(
        "Open ChatGPT or Codex on your laptop, then copy and paste the prompt below. "
        "It will walk you through installing the right tools, signing into GitHub, "
        "getting invited to the repository, and running the site.",
        subtitle,
    ),
    Paragraph("Repository", section),
    Paragraph("https://github.com/jacobdean66/jumpingjax-site", body),
    Spacer(1, 0.15 * inch),
    Paragraph("Copy This Into ChatGPT", section),
    para(prompt, code),
]

doc.build(story)
print(OUTPUT)
