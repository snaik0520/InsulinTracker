import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Medication } from "@shared/schema";

interface AddMedicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedMedication?: Medication | null; // existing medication for autopopulate
}

export function AddMedicationModal({ open, onOpenChange, preselectedMedication }: AddMedicationModalProps) {
  const [genericName, setGenericName] = useState("");
  const [medicalName, setMedicalName] = useState("");
  const [dose, setDose] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [expirationDate, setExpirationDate] = useState("");
  const [location, setLocation] = useState("");
  const [formType, setFormType] = useState<"pen" | "injection" | "">("");

  // Autopopulate fields if editing or selecting existing medication
  useEffect(() => {
    if (preselectedMedication) {
      setGenericName(preselectedMedication.genericName ?? "");
      setMedicalName(preselectedMedication.medicalName ?? "");
      setDose(preselectedMedication.dose ?? "");
      setQuantity(preselectedMedication.quantity ?? 1);
      setExpirationDate(preselectedMedication.expirationDate ?? "");
      setLocation(preselectedMedication.location ?? "");
      // Autopopulate Injection/Pen form type
      const resolvedForm = resolveFormType(preselectedMedication);
      setFormType(resolvedForm ?? "");
    } else {
      setGenericName("");
      setMedicalName("");
      setDose("");
      setQuantity(1);
      setExpirationDate("");
      setLocation("");
      setFormType("");
    }
  }, [preselectedMedication, open]);

  const handleSubmit = () => {
    if (!genericName || !dose || !quantity || !expirationDate || !location || !formType) {
      alert("All fields including administration form are required");
      return;
    }

    // Call API to save medication...
    onOpenChange(false);
  };

  // Robust resolver for administration form
  const resolveFormType = (med: Medication): "pen" | "injection" | undefined => {
    const anyMed = med as any;
    const strCandidates = [anyMed.formType, anyMed.form, anyMed.form_type, anyMed.formTypeName];
    for (const c of strCandidates) {
      if (!c) continue;
      const v = String(c).toLowerCase();
      if (v.includes("pen")) return "pen";
      if (v.includes("injection")) return "injection";
      if (v === "pen") return "pen";
      if (v === "injection") return "injection";
    }
    const boolCandidates = [anyMed.isPen, anyMed.is_pen, anyMed.pen, anyMed.isPenDevice];
    for (const b of boolCandidates) {
      if (typeof b === "boolean") return b ? "pen" : "injection";
      if (typeof b === "string") {
        const v = b.toLowerCase();
        if (v === "true") return "pen";
        if (v === "false") return "injection";
      }
    }
    if ((med.medicalName ?? "").toLowerCase().includes("pen")) return "pen";
    return undefined;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Medication</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <Label>Generic Name</Label>
            <Input value={genericName} onChange={(e) => setGenericName(e.target.value)} />
          </div>

          <div>
            <Label>Medical Name</Label>
            <Input value={medicalName} onChange={(e) => setMedicalName(e.target.value)} />
          </div>

          <div>
            <Label>Dose</Label>
            <Input value={dose} onChange={(e) => setDose(e.target.value)} />
          </div>

          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>

          <div>
            <Label>Expiration Date</Label>
            <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
          </div>

          <div>
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          {/* Injection / Pen required bubble selection */}
          <div>
            <Label>Administration Form</Label>
            <div className="flex gap-4 mt-2">
              <button
                type="button"
                onClick={() => setFormType("injection")}
                className={`px-4 py-2 border rounded ${
                  formType === "injection" ? "bg-blue-600 text-white" : "bg-white text-gray-800 border-gray-300"
                }`}
              >
                Injection
              </button>
              <button
                type="button"
                onClick={() => setFormType("pen")}
                className={`px-4 py-2 border rounded ${
                  formType === "pen" ? "bg-blue-600 text-white" : "bg-white text-gray-800 border-gray-300"
                }`}
              >
                Pen
              </button>
            </div>
          </div>

          <Button onClick={handleSubmit} className="mt-4 bg-primary hover:bg-primary/90">
            Save Medication
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
