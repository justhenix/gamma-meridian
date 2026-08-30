import assert from "node:assert/strict";
import test from "node:test";

import { getConsultationsAccessCopy } from "../../src/lib/consultations/access-copy";

test("consultations access copy positions Meridian as one continuous AI-to-expert consultation", () => {
  const english = getConsultationsAccessCopy("en");
  const indonesian = getConsultationsAccessCopy("id");

  assert.equal(english.title, "Access your consultations");
  assert.match(english.leftTitle, /One conversation/i);
  assert.match(english.leftBody, /expert/i);
  assert.equal(english.submitLabel, "Continue with email");

  assert.equal(indonesian.title, "Akses konsultasi Anda");
  assert.match(indonesian.leftTitle, /Satu percakapan/i);
  assert.match(indonesian.leftBody, /konsultan/i);
  assert.equal(indonesian.submitLabel, "Lanjutkan dengan email");
});
