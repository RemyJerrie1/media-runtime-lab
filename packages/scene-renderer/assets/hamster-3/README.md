# Hamster 3 asset

Accepted sculpt iteration 16: continuous seated underside, recessed ankles and visible pink toes.
Generated locally by this project's Blender Python code; no downloaded model, texture or external model-generation service is required.

- Source: `scripts/hamster/build.py`
- Generator: Blender 4.5.7, seeded strand placement (731)
- Asset: 40 meshes, 398,028 triangles, vertex-coloured short fur; no external textures
- SHA-256: `0bd3b3c9d661d8db7da29edcc72c5f8b91c51ff61df0c0b70d6d0e87fd914e71`
- Scope and acceptance: [issue #8](https://github.com/RemyJerrie1/media-runtime-lab/issues/8)

From the repository root, run:

```sh
blender --background --factory-startup --python scripts/hamster/build.py
```

The generator writes GLB and an editable Blender scene to ignored `.runtime/hamster-build/`.
Set `HAMSTER_OUTPUT` to choose another output directory. After inspecting the result,
copy `hamster-prototype.glb` to this directory as `hamster.glb`.
Do not commit Blender binaries, .blend backups or the prototype viewer.

The checked-in GLB is used by both the web model route and isolated Chromium capture.
The matching `studio-env.bin` is the 768×1024 RGBA half-float CubeUV PMREM of
Three.js r186's `RoomEnvironment` at sigma 0.04. Regenerate it from the repository
root with `node scripts/hamster/bake-environment.mjs` (Playwright Chromium required).
Its SHA-256 is `e97a5a7639e17cc48f2bb05f0621c8387aadb7493fcbaa36817c6d417e746419`.
It preserves the original lighting while moving PMREM generation out of each mount;
both preview and capture validate and load the same 6 MiB binary.
Normal builds and CI do not require Blender. Future appearance changes must get a new
renderer version and asset path, preserving existing jobs' output identity.

Animation uses absolute-time root motion, body lift and small foot offsets, not a skeleton.
The accepted model is a stylised real-time asset, not a photorealistic reproduction of the concept.
