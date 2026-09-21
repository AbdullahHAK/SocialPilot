import { findExpiredJobImages, markContentJobsImagesDeleted } from "@socialpilot/db";
import { deleteGeneratedImage } from "@socialpilot/content-engine";

const CLEANUP_BATCH_SIZE = 50;

/**
 * Deletes each finished day's post/Story image files from storage 24 hours
 * after they went out (see findExpiredJobImages for exactly what qualifies
 * and what is protected), then flags the jobs so the calendar shows an
 * "image removed" placeholder. Files are deleted before the flag is set, so
 * a failure in between just retries next cycle (deleting an already-gone
 * file is a no-op) instead of leaving a flagged job whose file still exists.
 */
export async function runJobImageCleanupCycle(now: Date = new Date()): Promise<void> {
  const expired = await findExpiredJobImages(now, CLEANUP_BATCH_SIZE);

  for (const group of expired) {
    try {
      await Promise.all(group.imageUrls.map((url) => deleteGeneratedImage(url)));
      await markContentJobsImagesDeleted(group.jobIds, now);
    } catch (error) {
      console.error(`Cleaning up expired post images for org ${group.organizationId} failed`, error);
    }
  }
}
