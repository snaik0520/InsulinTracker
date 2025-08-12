/* ────────────────────────────────────────────────
   AddMedicationModal
   (fixed equality bug + graceful error handling)
──────────────────────────────────────────────── */
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertMedicationSchema,
  type InsertMedication,
  type Medication,
} from "@shared/schema";
import {
  useMutation,
  useQueryClient,
  useQuery,
} from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function AddMedicationModal({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: allMeds = [], isError } = useQuery<Medication[]>({
    queryKey: ["/api/medications"],
    enabled: open,
    retry: false,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/medications");
      if (!res.ok) throw new Error("Could not load medications");
      return res.json();
    },
  });

  const uniqueMeds = allMeds.reduce((acc, med) => {
    const exists = acc.find(
      (m) =>
        m.genericName === med.genericName &&
        m.medicalName === med.medicalName
    );
    if (!exists) {
      const total = allMeds
        .filter(
          (m): m is Medication =>
            m.genericName === med.genericName &&
            m.medicalName === med.medicalName
        )
        .reduce((s, m) => s + m.quantity, 0);
      acc.push({ ...med, quantity: total });
    }
    return acc;
  }, [] as Medication[]);

  const form = useForm<InsertMedication>({
    resolver: zodResolver(insertMedicationSchema),
    defaultValues: {
      genericName: "",
      medicalName: "",
      type: "",
      dose: "",
      quantity: 0,
      expirationDate: "",
      location: "",
    },
  });

  const addMutation = useMutation({
    mutationFn: async (d: InsertMedication) => {
      const res = await apiRequest("POST", "/api/medications", d);
      if (!res.ok) throw new Error("Server error");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/medications"] });
      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Success", description: "Medication added." });
      form.reset();
      onOpenChange(false);
    },
    onError: (e: Error) =>
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      }),
  });

  const autofill = (id: string) => {
    const m = uniqueMeds.find((x) => x.id === id);
    if (!m) return;
    form.reset({
      ...form.getValues(),
      genericName: m.genericName,
      medicalName: m.medicalName,
      type: m.type,
      dose: m.dose,
      location: m.location,
      quantity: 0,
      expirationDate: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add Insulin Medication
          </DialogTitle>
        </DialogHeader>

        {!isError && uniqueMeds.length > 0 && (
          <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
            <Label className="text-sm font-medium text-blue-800">
              Select Existing Medication (optional)
            </Label>
            <Select onValueChange={autofill}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an existing medication..." />
              </SelectTrigger>
              <SelectContent>
                {uniqueMeds.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex justify-between w-full">
                      <span>
                        {m.genericName} ({m.medicalName})
                      </span>
                      <span className="text-xs text-gray-500">
                        {m.quantity} vials
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <form
          onSubmit={form.handleSubmit((d) => addMutation.mutate(d))}
          className="space-y-4"
        >
          {/* names */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Generic Name</Label>
              <Input
                placeholder="e.g., Insulin Lispro"
                {...form.register("genericName")}
              />
            </div>
            <div>
              <Label>Brand / Medical Name</Label>
              <Input
                placeholder="e.g., Humalog"
                {...form.register("medicalName")}
              />
            </div>
          </div>

          {/* type + dose */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Insulin Type</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v) => form.setValue("type", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rapid">Rapid Acting</SelectItem>
                  <SelectItem value="long">Long Acting</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dose</Label>
              <Input
                placeholder="e.g., 100 units/mL"
                {...form.register("dose")}
              />
            </div>
          </div>

          {/* quantity + expiration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min={0}
                {...form.register("quantity", { valueAsNumber: true })}
              />
            </div>
            <div>
              <Label>Expiration Date</Label>
              <Input type="date" {...form.register("expirationDate")} />
            </div>
          </div>

          {/* location */}
          <div>
            <Label>Storage Location</Label>
            <Input
              placeholder="e.g., Fridge A – Shelf 2"
              {...form.register("location")}
            />
          </div>

          {/* actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1" disabled={addMutation.isPending}>
              {addMutation.isPending ? "Adding…" : "Add Medication"}
            </Button>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────────────────────────────────────
   Export BOTH default and named so imports
   using either style work.
────────────────────────────────────────── */
export default AddMedicationModal;
export { AddMedicationModal };
