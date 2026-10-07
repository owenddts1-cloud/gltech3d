import { NextResponse } from "next/server";
import { executePricingEngine } from "@/lib/ai/agents/pricing";
import { matchOptimalMachine, dispatchProductionJob } from "@/lib/ai/agents/orchestrator";
import { reserveAndDeductSpoolMass, evaluateInventoryRunoutRisk } from "@/lib/ai/agents/inventory";
import { generateTechnicalProposal, dispatchCustomerUpdate } from "@/lib/ai/agents/cx";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { event, tenant_id, payload } = body;

    if (!event || !tenant_id) {
      return NextResponse.json({ ok: false, error: "Missing event or tenant_id" }, { status: 400 });
    }

    switch (event) {
      case "quote.requested": {
        const pricing = executePricingEngine({
          net_mass_g: Number(payload.net_mass_g ?? 0),
          support_mass_g: Number(payload.support_mass_g ?? 0),
          number_of_switches: Number(payload.number_of_switches ?? 0),
          purge_mass_per_switch_g: Number(payload.purge_mass_per_switch_g ?? 0),
          waste_factor: Number(payload.waste_factor ?? 0.03),
          spool_cost_per_kg: Number(payload.spool_cost_per_kg ?? 90.0),
          print_time_hours: Number(payload.print_time_hours ?? 1.0),
          average_power_watts: Number(payload.average_power_watts ?? 150),
          kwh_rate_brl: Number(payload.kwh_rate_brl ?? 0.85),
          prep_time_min: Number(payload.prep_time_min ?? 10),
          support_removal_time_min: Number(payload.support_removal_time_min ?? 0),
          brass_inserts_count: Number(payload.brass_inserts_count ?? 0),
          time_per_insert_min: Number(payload.time_per_insert_min ?? 2),
          post_processing_time_min: Number(payload.post_processing_time_min ?? 0),
          qc_time_min: Number(payload.qc_time_min ?? 5),
          hourly_labor_rate_brl: Number(payload.hourly_labor_rate_brl ?? 40.0),
          polymer: payload.polymer ?? "PLA",
        });

        return NextResponse.json({
          ok: true,
          agent: "PricingEngineAgent",
          event: "pricing.calculated",
          pricing,
        });
      }

      case "order.approved": {
        const matchedMachine = matchOptimalMachine(payload.farm || [], {
          required_polymer: payload.polymer || "PLA",
          required_nozzle_diameter: Number(payload.nozzle_diameter || 0.4),
          requires_enclosure: Boolean(payload.requires_enclosure),
          is_multi_material: Boolean(payload.is_multi_material),
          build_volume_required_mm: payload.build_volume || { x: 100, y: 100, z: 100 },
        });

        if (!matchedMachine) {
          return NextResponse.json({
            ok: false,
            agent: "FarmOrchestratorAgent",
            error: "Nenhuma impressora disponível atende aos requisitos do job.",
          });
        }

        const dispatch = dispatchProductionJob({
          order_item_id: payload.order_item_id || "item-123",
          target_machine_id: matchedMachine.id,
          target_spool_id: payload.spool_id || "spool-123",
          gcode_file_url: payload.gcode_file_url || "https://storage.gltech3d.com/jobs/part.gcode",
          priority_score: Number(payload.priority || 1),
        });

        return NextResponse.json({
          ok: true,
          agent: "FarmOrchestratorAgent",
          event: "job.dispatched",
          matched_machine: matchedMachine,
          dispatch,
        });
      }

      case "job.started": {
        const deduction = reserveAndDeductSpoolMass(
          payload.spool,
          Number(payload.mass_g ?? 0),
          "reserve"
        );

        return NextResponse.json({
          ok: deduction.ok,
          agent: "InventorySentinelAgent",
          event: "inventory.reserved",
          deduction,
        });
      }

      case "qc.passed": {
        const update = dispatchCustomerUpdate({
          order_id: payload.order_id || "ord-123",
          event_type: "qc_photos_available",
          media_urls: payload.photo_urls || [],
        });

        return NextResponse.json({
          ok: true,
          agent: "CXPumpAgent",
          event: "customer.notified",
          update,
        });
      }

      default:
        return NextResponse.json({ ok: false, error: "Evento desconhecido" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Internal error" }, { status: 500 });
  }
}
