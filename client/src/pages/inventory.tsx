import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Medication } from "@shared/schema";

interface AddMedicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingMedication?: Medication | null;
  onSave?: (medication: Medication) => void;
}

export function AddMedicationModal({ open, onOpenChange, existingMedication, onSave }: AddMedicationModalProps) {
  const [medicalName, setMedicalName] = useState("");
  const [genericName, setGenericName] = useState("");
  const [dose, setDose] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [type, setType] = useState<Medication["type"]>("other");
  const [formType, setFormType] = useState<"injection" | "pen" | "">("");

  useEffect(() => {
    if (existingMedication) {
      setMedicalName(existingMedication.medicalName || "");
      setGenericName(existingMedication.genericName || "");
      setDose(existingMedication.dose || "");
      setQuantity(existingMedication.quantity || 0);
      setType(existingMedication.type || "other");
      setFormType(existingMedication.formType || "");
    } else {
      setMedicalName("");
      setGenericName("");
      setDose("");
      setQuantity(0);
      setType("other");
      setFormType("");
    }
  }, [existingMedication]);

  const handleSave = () => {
    if (!formType) {
      alert("Administration Form is required.");
      return;
    }

    const newMed: Medication = {
      id: existingMedication?.id || Date.now().toString(),
      medicalName,
      genericName,
      dose,
      quantity,
      type,
      formType,
    };

    onSave?.(newMed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existingMedication ? "Edit Medication" : "Add New Medication"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Medical Name</Label>
            <Input value={medicalName} onChange={(e) => setMedicalName(e.target.value)} />
          </div>

          <div>
            <Label>Generic Name</Label>
            <Input value={genericName} onChange={(e) => setGenericName(e.target.value)} />
          </div>

          <div>
            <Label>Dose</Label>
            <Input value={dose} onChange={(e) => setDose(e.target.value)} />
          </div>

          <div>
            <Label>Quantity</Label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </div>

          <div>
            <Label>Insulin Type</Label>
            <Select value={type} onValueChange={(val) => setType(val as Medication["type"])}>
              <SelectTrigger>
                <SelectValue placeholder="Select Insulin Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rapid">Rapid Acting</SelectItem>
                <SelectItem value="long">Long Acting</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* NEW: Administration Form */}
          <div>
            <Label>Administration Form <span className="text-red-500">*</span></Label>
            <Select value={formType} onValueChange={(val) => setFormType(val as "injection" | "pen")}>
              <SelectTrigger>
                <SelectValue placeholder="Select Form" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="injection">Injection</SelectItem>
                <SelectItem value="pen">Pen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full mt-4" onClick={handleSave}>
            {existingMedication ? "Save Changes" : "Add Medication"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
