# Versioned local hamster asset

Related: [#8](https://github.com/RemyJerrie1/media-runtime-lab/issues/8).
This supersedes only the new-job renderer version in ADR 0004; its audio contract remains unchanged.

The accepted sculpt needs a continuous silhouette and deterministic short fur.
Rebuilding its mesh in every browser or relying on an external generation service
would add startup cost or an unavailable dependency.

Commit one locally generated GLB plus its Blender Python source. Both preview and
capture await model readiness and use the same renderer. Keep Blender outside the
runtime and CI dependency graph. The model route serves the asset from the monorepo;
run the web app through its package scripts with apps/web as the working directory.

New v4 scene jobs use hamster-3. Existing hamster-1 and hamster-2 jobs keep the
unchanged legacy renderer. Idempotency comparisons use the stored renderer version,
so upgrading does not invalidate a retry whose content is unchanged.

Tradeoff: the asset is approximately 20 MB and is not skeleton-rigged. Loading can fail,
so the editor exposes retry and capture fails without publishing a partial artifact.
This iteration retains procedural root/body/foot motion. Asset optimisation and a
skeletal animation system require separate appearance and motion acceptance.
