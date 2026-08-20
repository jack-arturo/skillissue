# Doctor, troubleshooting & reference links

Read this when: verifying the Raycast install/config state before automating
anything, or a deeplink/Script Command/AI Skill isn't behaving as expected.

---

## Doctor

```bash
test -d /Applications/Raycast.app && echo "app: ok" || echo "app: MISSING"
open -Ra Raycast 2>/dev/null || true

# Extension manifests (config copy used for development + many installs)
python3 - <<'PY'
import json, pathlib
root = pathlib.Path.home() / ".config/raycast/extensions"
if not root.exists():
    print("no ~/.config/raycast/extensions")
else:
    for d in sorted(root.iterdir()):
        pkg = d / "package.json"
        if not pkg.is_file():
            continue
        j = json.loads(pkg.read_text())
        author = j.get("author") or j.get("owner") or "?"
        if isinstance(author, dict):
            author = author.get("name") or author.get("handle") or "?"
        cmds = [c.get("name") for c in (j.get("commands") or [])]
        print(f"{j.get('name')}\t{author}\t{len(cmds)} cmds")
PY

echo "providers: $HOME/.config/raycast/ai/providers.yaml"
ls -la "$HOME/Documents/Raycast Scripts" 2>/dev/null || true
ls -la "$HOME/.config/raycast/skills" 2>/dev/null || echo "skills dir not created yet"
```

If deeplinks prompt every time: in Raycast, allow deeplinks for that
command (prefs key family `alwaysAllowCommandDeeplinking`). User can
also use **Copy Deeplink** (⌘K → Copy Deeplink / ⌘⇧C) from root search.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Deeplink does nothing | App not running; `open -a Raycast`; check extension installed/enabled |
| Confirm prompt every time | Allow deeplink for that command in Raycast |
| Command name wrong | Re-read extension `package.json`; Copy Deeplink from UI |
| Script Command missing | Confirm Script Directory; Reload Script Directories; check `@raycast.schemaVersion` |
| AI models missing | Check `providers.yaml`; hub up for AutoJack; restart Raycast |
| AI Skill not loading | Folder/name/`SKILL.md` rules; tool-capable model; wait ~60s; try `@` mention |
| Accessibility / paste fails | Grant Accessibility to **Raycast** (not Terminal) |

---

## Reference links

- Deeplinks: https://developers.raycast.com/information/lifecycle/deeplinks
- Script Commands: https://manual.raycast.com/script-commands
  https://github.com/raycast/script-commands
- AI Commands / Agents / Skills: https://manual.raycast.com/ai
- AI Skills folders: https://manual.raycast.com/ai/skills
- Preset explorer: https://ray.so/presets
