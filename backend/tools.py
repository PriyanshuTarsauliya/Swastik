"""Swastik Healthcare tools for Gemini Live API session."""

import io
import os
import logging
import urllib.parse
from pathlib import Path

import qrcode

log = logging.getLogger("swastik-agent")

TOOL_DECLARATIONS = [
    {
        "name": "get_clinic_info",
        "description": "Get Swastik Healthcare clinic hours, ₹499 consultation fee, policies, and address.",
        "parameters": {
            "type": "object",
            "properties": {},
        },
    },
    {
        "name": "get_available_slots",
        "description": "Fetch available consultation slots between 11:00 AM and 1:30 PM (Monday to Saturday).",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "Medical category (e.g. Women's Health, Skin Problems, Hair Fall, Digestive System, Chronic Care, Children's Health)",
                },
                "date": {
                    "type": "string",
                    "description": "Preferred date or 'Tomorrow'",
                },
            },
            "required": [],
        },
    },
    {
        "name": "book_consultation",
        "description": "Book an appointment slot for a patient at Swastik Healthcare.",
        "parameters": {
            "type": "object",
            "properties": {
                "patient_name": {"type": "string", "description": "Patient's full name"},
                "age": {"type": "string", "description": "Patient's age"},
                "gender": {"type": "string", "description": "Gender (Male/Female/Other)"},
                "phone": {"type": "string", "description": "WhatsApp/Contact Number"},
                "category": {"type": "string", "description": "Health issue category"},
                "consultation_mode": {"type": "string", "description": "Consultation mode ('Online' or 'Offline')", "enum": ["Online", "Offline"]},
                "slot_time": {"type": "string", "description": "Confirmed slot time (e.g. 11:00 AM, 11:30 AM, 12:00 PM)"},
                "locality": {"type": "string", "description": "City or Locality"},
            },
            "required": ["patient_name", "slot_time"],
        },
    },
    {
        "name": "send_whatsapp_confirmation",
        "description": "Send instant WhatsApp booking confirmation with ₹499 payment details and clinic guidelines.",
        "parameters": {
            "type": "object",
            "properties": {
                "phone": {"type": "string", "description": "WhatsApp number (default: 76018 39607)"},
                "patient_name": {"type": "string", "description": "Patient Name"},
                "slot_time": {"type": "string", "description": "Confirmed time slot"},
                "category": {"type": "string", "description": "Consultation Category"},
                "consultation_mode": {"type": "string", "description": "Consultation mode: 'Online' or 'Offline'"},
            },
            "required": ["patient_name", "slot_time"],
        },
    },
    {
        "name": "generate_upi_payment",
        "description": "Generate a UPI payment QR code and deep link for the ₹499 consultation fee. Call this after booking is confirmed so the patient can pay immediately.",
        "parameters": {
            "type": "object",
            "properties": {
                "patient_name": {"type": "string", "description": "Patient's name for the transaction note"},
                "amount": {"type": "string", "description": "Amount to pay (default: 499)"},
            },
            "required": ["patient_name"],
        },
    },
]

# Simulated in-memory slots state
CLINIC_SLOTS = [
    {"time": "11:00 AM", "type": "Initial Consultation", "status": "FREE"},
    {"time": "11:30 AM", "type": "Follow-up Consultation", "status": "FREE"},
    {"time": "12:00 PM", "type": "Initial Consultation", "status": "BOOKED"},
    {"time": "12:30 PM", "type": "Follow-up Consultation", "status": "FREE"},
    {"time": "1:00 PM", "type": "Initial Consultation", "status": "FREE"},
]


def dispatch_tool(name: str, args: dict):
    """Dispatch tool call and return (ui_cmd | None, function_result)."""
    if name == "get_clinic_info":
        info = {
            "clinic": "Dr. Gunja Gupta Homeopathy Consultant",
            "fee": "₹499",
            "call_hours": "11:00 AM to 1:30 PM (Mon-Sat)",
            "whatsapp_hours": "11:00 AM to 6:00 PM (Mon-Sat)",
            "sunday": "Closed",
            "reschedule_policy": "Reschedule up to 24h prior (Max 1 time). Fee strictly non-refundable.",
            "reports_note": "Bring hard copies of previous medical reports and test results.",
        }
        return {"action": "show_policy", "data": info}, {"result": "ok", "info": info}

    if name == "get_available_slots":
        category = args.get("category", "General Health")
        return {
            "action": "show_calendar",
            "category": category,
            "slots": CLINIC_SLOTS,
        }, {"result": "ok", "slots": CLINIC_SLOTS, "calling_hours": "11:00 AM - 1:30 PM"}

    if name == "book_consultation":
        patient_name = args.get("patient_name", "Patient")
        slot_time = args.get("slot_time", "11:00 AM")
        phone = args.get("phone", "76018 39607")
        category = args.get("category", "General Health")
        consultation_mode = args.get("consultation_mode", "Online")

        # Mark slot as booked
        for slot in CLINIC_SLOTS:
            if slot["time"].lower() == slot_time.lower():
                slot["status"] = "BOOKED"

        booking_data = {
            "patient_name": patient_name,
            "slot_time": slot_time,
            "phone": phone,
            "category": category,
            "consultation_mode": consultation_mode,
            "fee": "₹499",
            "status": "CONFIRMED",
        }
        return {
            "action": "booking_confirmed",
            "data": booking_data,
            "slots": CLINIC_SLOTS,
        }, {"result": "ok", "booking": booking_data}

    if name == "send_whatsapp_confirmation":
        phone = args.get("phone", "76018 39607")
        patient_name = args.get("patient_name", "Patient")
        slot_time = args.get("slot_time", "11:00 AM")
        category = args.get("category", "General Health")
        consultation_mode = args.get("consultation_mode", "Online")

        import urllib.parse
        form_url = "https://docs.google.com/forms/d/e/1FAIpQLScUwhHgwBxD6rYFw_G_GZKGCePkjrBqBoRSTR6Wa9SAQP_Sqg/viewform?usp=dialog"
        message_text = f"Dr. Gunja Gupta Homeopathy Consultant: {patient_name} - your {consultation_mode} appointment for {category} is confirmed for tomorrow at {slot_time}. Consultation fee: ₹499. Please fill details & upload payment receipt screenshot here: {form_url}"
        
        # Clean phone number for wa.me link (remove spaces/symbols)
        clean_phone = "".join(filter(str.isdigit, phone))
        if not clean_phone.startswith("91") and len(clean_phone) == 10:
            clean_phone = "91" + clean_phone
            
        wa_url = f"https://wa.me/{clean_phone}?text={urllib.parse.quote(message_text)}"

        import os
        from twilio.rest import Client
        import logging
        log = logging.getLogger("swastik-agent")

        sid = os.environ.get("TWILIO_ACCOUNT_SID")
        token = os.environ.get("TWILIO_AUTH_TOKEN")
        from_num = os.environ.get("TWILIO_WHATSAPP_NUMBER")
        
        if sid and token and from_num:
            try:
                client = Client(sid, token)
                content_sid = os.environ.get("TWILIO_CONTENT_SID")
                if content_sid:
                    msg = client.messages.create(
                        from_=from_num,
                        content_sid=content_sid,
                        to=f"whatsapp:+{clean_phone}"
                    )
                else:
                    msg = client.messages.create(
                        from_=from_num,
                        body=message_text,
                        to=f"whatsapp:+{clean_phone}"
                    )
                log.info(f"Twilio message sent: {msg.sid}")
            except Exception as e:
                log.error(f"Failed to send Twilio message: {e}")

        wa_data = {
            "phone": phone,
            "patient_name": patient_name,
            "slot_time": slot_time,
            "category": category,
            "consultation_mode": consultation_mode,
            "fee": "₹499",
            "form_url": form_url,
            "message": message_text,
            "wa_url": wa_url
        }
        return {"action": "whatsapp_send", "data": wa_data}, {"result": "ok", "whatsapp": wa_data}

    if name == "generate_upi_payment":
        patient_name = args.get("patient_name", "Patient")
        amount = args.get("amount", "499")
        upi_id = os.environ.get("UPI_ID", "6387831138-2@ibl")
        payee_name = os.environ.get("UPI_PAYEE_NAME", "Dr Gunja Gupta")

        # Build the UPI deep link
        upi_params = urllib.parse.urlencode({
            "pa": upi_id,
            "pn": payee_name,
            "am": amount,
            "cu": "INR",
            "tn": f"Consultation fee - {patient_name}",
        })
        upi_link = f"upi://pay?{upi_params}"

        # Generate QR code PNG and save to assets/
        assets_dir = Path(__file__).resolve().parents[1] / "assets"
        assets_dir.mkdir(exist_ok=True)
        qr_path = assets_dir / "upi_qr.png"

        qr = qrcode.QRCode(version=1, box_size=8, border=2)
        qr.add_data(upi_link)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#0F766E", back_color="#F0FDFA")
        img.save(str(qr_path))
        log.info(f"UPI QR saved to {qr_path}")

        upi_data = {
            "upi_id": upi_id,
            "payee_name": payee_name,
            "amount": amount,
            "upi_link": upi_link,
            "qr_url": "/assets/upi_qr.png",
            "patient_name": patient_name,
        }
        return {"action": "show_upi_payment", "data": upi_data}, {"result": "ok", "upi": upi_data}

    return None, {"result": f"unknown tool: {name}"}
