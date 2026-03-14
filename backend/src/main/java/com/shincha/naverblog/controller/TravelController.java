package com.shincha.naverblog.controller;

import com.shincha.naverblog.model.dto.*;
import com.shincha.naverblog.model.service.TravelServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/travel")
@RequiredArgsConstructor
public class TravelController {

    private final TravelServiceImpl travelService;

    private Long getUserId() {
        return (Long) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    // ── Trip ─────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> getTrips() {
        try {
            return ResponseEntity.ok(travelService.getTrips(getUserId()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createTrip(@RequestBody TravelTrip trip) {
        try {
            return ResponseEntity.ok(travelService.createTrip(trip, getUserId()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{tripId}")
    public ResponseEntity<?> getTrip(@PathVariable Long tripId) {
        try {
            TravelTrip trip = travelService.getTrip(tripId, getUserId());
            if (trip == null) return ResponseEntity.notFound().build();
            return ResponseEntity.ok(trip);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{tripId}")
    public ResponseEntity<?> updateTrip(@PathVariable Long tripId, @RequestBody TravelTrip trip) {
        try {
            trip.setId(tripId);
            travelService.updateTrip(trip, getUserId());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{tripId}")
    public ResponseEntity<?> deleteTrip(@PathVariable Long tripId) {
        try {
            travelService.deleteTrip(tripId, getUserId());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── AI 생성 ───────────────────────────────────────────────────────────────

    @PostMapping("/{tripId}/generate")
    public ResponseEntity<?> generatePlan(@PathVariable Long tripId) {
        try {
            return ResponseEntity.ok(travelService.generatePlan(tripId, getUserId()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{tripId}/fill-gaps")
    public ResponseEntity<?> fillGaps(@PathVariable Long tripId) {
        try {
            return ResponseEntity.ok(travelService.fillGaps(tripId, getUserId()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{tripId}/complete")
    public ResponseEntity<?> completePlan(@PathVariable Long tripId,
                                           @RequestBody Map<String, Object> body) {
        try {
            String existingPlan = (String) body.get("existingPlan");
            @SuppressWarnings("unchecked")
            List<Map<String, String>> images = (List<Map<String, String>>) body.get("images");
            return ResponseEntity.ok(travelService.completePlan(tripId, existingPlan, images, getUserId()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Itinerary ─────────────────────────────────────────────────────────────

    @PostMapping("/{tripId}/itinerary")
    public ResponseEntity<?> addItinerary(@PathVariable Long tripId,
                                           @RequestBody TravelItinerary item) {
        try {
            item.setTripId(tripId);
            return ResponseEntity.ok(travelService.addItinerary(item));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{tripId}/itinerary/{itemId}")
    public ResponseEntity<?> updateItinerary(@PathVariable Long itemId,
                                              @RequestBody TravelItinerary item) {
        try {
            item.setId(itemId);
            travelService.updateItinerary(item);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{tripId}/itinerary/{itemId}")
    public ResponseEntity<?> deleteItinerary(@PathVariable Long itemId) {
        try {
            travelService.deleteItinerary(itemId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Checklist ─────────────────────────────────────────────────────────────

    @PostMapping("/{tripId}/checklist")
    public ResponseEntity<?> addChecklist(@PathVariable Long tripId,
                                           @RequestBody TravelChecklist item) {
        try {
            item.setTripId(tripId);
            return ResponseEntity.ok(travelService.addChecklist(item));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{tripId}/checklist/{itemId}/status")
    public ResponseEntity<?> updateChecklistStatus(@PathVariable Long itemId,
                                                    @RequestBody Map<String, String> body) {
        try {
            travelService.updateChecklistStatus(itemId, body.get("status"));
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{tripId}/checklist/{itemId}")
    public ResponseEntity<?> updateChecklistItem(@PathVariable Long itemId,
                                                  @RequestBody TravelChecklist item) {
        try {
            item.setId(itemId);
            travelService.updateChecklistItem(item);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{tripId}/checklist/{itemId}")
    public ResponseEntity<?> deleteChecklist(@PathVariable Long itemId) {
        try {
            travelService.deleteChecklist(itemId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Expense ───────────────────────────────────────────────────────────────

    @PostMapping("/{tripId}/expenses")
    public ResponseEntity<?> addExpense(@PathVariable Long tripId,
                                         @RequestBody TravelExpense expense) {
        try {
            expense.setTripId(tripId);
            // 여행 인원수 기반 1인 기준 자동 계산
            TravelTrip trip = travelService.getTrip(tripId, getUserId());
            if (trip != null && trip.getTravelers() != null && trip.getTravelers() > 0) {
                int travelers = trip.getTravelers();
                if (expense.getAmount() != null) {
                    expense.setAmountPerPerson(
                            expense.getAmount().divide(BigDecimal.valueOf(travelers), 2, java.math.RoundingMode.HALF_UP));
                }
                if (expense.getAmountKrw() != null) {
                    expense.setAmountKrwPerPerson(
                            expense.getAmountKrw().divide(BigDecimal.valueOf(travelers), 0, java.math.RoundingMode.HALF_UP));
                }
            }
            return ResponseEntity.ok(travelService.addExpense(expense));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{tripId}/expenses/{expenseId}")
    public ResponseEntity<?> updateExpense(@PathVariable Long tripId,
                                            @PathVariable Long expenseId,
                                            @RequestBody TravelExpense expense) {
        try {
            expense.setId(expenseId);
            // 1인 기준 재계산
            TravelTrip trip = travelService.getTrip(tripId, getUserId());
            if (trip != null && trip.getTravelers() != null && trip.getTravelers() > 0) {
                int travelers = trip.getTravelers();
                if (expense.getAmount() != null) {
                    expense.setAmountPerPerson(
                            expense.getAmount().divide(BigDecimal.valueOf(travelers), 2, java.math.RoundingMode.HALF_UP));
                }
                if (expense.getAmountKrw() != null) {
                    expense.setAmountKrwPerPerson(
                            expense.getAmountKrw().divide(BigDecimal.valueOf(travelers), 0, java.math.RoundingMode.HALF_UP));
                }
            }
            travelService.updateExpense(expense);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{tripId}/expenses/{expenseId}")
    public ResponseEntity<?> deleteExpense(@PathVariable Long expenseId) {
        try {
            travelService.deleteExpense(expenseId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    // ── 각종 정보 ──────────────────────────────────────────────────────────────

    @PutMapping("/{tripId}/info")
    public ResponseEntity<?> updateInfo(@PathVariable Long tripId,
                                         @RequestBody Map<String, String> body) {
        try {
            TravelTrip trip = new TravelTrip();
            trip.setId(tripId);
            trip.setUserId(getUserId());
            trip.setInfoContent(body.get("infoContent"));
            travelService.updateTrip(trip, getUserId());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
