import { fetchSliceableModels, fetchPrintProfile } from "@/app/actions/models/actions";
import { DEFAULT_PROFILE } from "@/lib/slicer/gcode";
import { SlicerClient } from "./_components/SlicerClient";

export const metadata = { title: "Fatiar" };
export const dynamic = "force-dynamic";

export default async function SlicerPage() {
  const [models, profile] = await Promise.all([fetchSliceableModels(), fetchPrintProfile()]);

  return (
    <SlicerClient
      models={models.ok ? models.models : []}
      profile={profile.ok ? profile.profile : DEFAULT_PROFILE}
    />
  );
}
