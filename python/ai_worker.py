"""Private stdin/stdout transport; secrets never enter process arguments."""
import json
import sys
from dt_manager_worker.ai_service import load_settings, save_settings, generate_description, generate_tags


def main():
    try:
        request = json.load(sys.stdin)
        action = request.get("action")
        payload = request.get("payload", {})
        if action == "load":
            result = load_settings()
        elif action == "save":
            result = save_settings(payload)
        elif action == "generate":
            result = generate_description(payload.get("sourcePath", ""))
        elif action == "generate-tags":
            result = generate_tags(payload.get("sourcePath", ""))
        else:
            raise ValueError("Unknown AI action.")
        response = {"ok": True, "data": result}
    except ValueError as error:
        response = {"ok": False, "error": str(error)}
    except Exception:
        response = {"ok": False, "error": "Unable to complete the AI operation. Check settings and image file access."}
    print(json.dumps(response))


if __name__ == "__main__":
    main()
