// 👇 only the reducer section shown; keep the rest of the file unchanged
const existingMedications = allMedications.reduce((unique, medication) => {
  const existingMed = unique.find(
    (m) =>
      m.genericName === medication.genericName &&
      m.medicalName === medication.medicalName
  );

  if (!existingMed) {
    // ⬇️ FIXED equality check (===) instead of assignment (=)
    const totalQuantity = allMedications
      .filter(
        (m): m is Medication =>
          m.genericName === medication.genericName &&
          m.medicalName === medication.medicalName
      )
      .reduce((sum, m) => sum + m.quantity, 0);

    unique.push({
      ...medication,
      quantity: totalQuantity,
    });
  }

  return unique;
}, [] as Medication[]);
