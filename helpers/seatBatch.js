import moment from "moment";
//it will break map into seats
function GetMapSeats(data) {
  let seatArray = [];
  if (data && data.pages && data.pages.length > 0 && data.pages[0] && data.pages[0].segments) {
    data.pages[0].segments.map(composit => {
      if(composit?.segments)
      {
        composit.segments.map(SECTION => {

          if (SECTION.segments && SECTION.segments.length > 0)
            SECTION.segments.map(ROW => {
              ROW.placesNoKeys.map(seat => {
                seatArray.push({
                  section: SECTION?.name,
                  row: ROW?.name,
                  seat: seat[1],
                  seatId: seat[0]
                })
              })
            })
          else {
            //GernalAdmission seats
            //console.log(SECTION,"sec")
          }
        })
      }
     

    })
  }

  return seatArray;


}
function breakArray(arr) {
  let result = [];
  let subarray = [arr[0]];

  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] + 1 !== arr[i + 1]) {
      result.push(subarray);
      subarray = [arr[i + 1]];
    } else {
      subarray.push(arr[i + 1]);
    }
  }

  result.push(subarray);
  return result;
}
 
function CreateConsicutiveSeats(data){
  const mergedData = [];

data.forEach((item) => {
  const existingGroup = mergedData.find(
    (group) =>
      group.section === item.section &&
      group.row === item.row &&
      group.offerId === item.offerId &&
      group.seats[group.seats.length - 1] + 1 === item.seats[0]
  );

  if (existingGroup) {
    existingGroup.seats.push(...item.seats);
  } else {
    mergedData.push({
      amount: item.amount,
      lineItemType: item.lineItemType,
      section: item.section,
      row: item.row,
      seats: [...item.seats],
      offerId: item.offerId,
      accessibility:item?.accessibility,
      descriptionId:item?.descriptionId,
      attributes:item?.attributes
    });
  }
});

 
return mergedData;
}
function getSplitType(arr,offer){

   var length = arr.length;

    if(offer && offer?.ticketTypeUnsoldQualifier && (offer?.ticketTypeUnsoldQualifier=="2PACKHOLD" || offer?.ticketTypeUnsoldQualifier=="222PA1HOLD" || offer?.ticketTypeUnsoldQualifier=="22BOGOHOLD"))
  {
    if (length === 2) {
      return "2";
    } else if (length === 4) {
      return "2,4";
    } else if (length >= 6) {
      var numbers = Array.from({ length: length%2==0?length:length-1 }, (_, i) => i%2==0?i+2:undefined).filter(x=>x!=undefined);
       return  numbers.join(",");
    }
    else return "2"

  }
  else
  {
    
    if (length === 2) {
      return "2";
    } else if (length === 3) {
      return "3";
    } else if (length === 4) {
      return "2,4";
    } else if (length >= 5) {
      var numbers = Array.from({ length: length }, (_, i) => i+1).filter(x=>x!=1);
      return  numbers.join(",");
    }
    else return "1"
  }
  
  
}
function CreateInventoryAndLine(data,offer,event,descriptions)
{
    
      if (!data || !offer) {
        console.log("Missing required data or offer in CreateInventoryAndLine");
        return undefined;
      }
 
  let _descriptions=descriptions.find(x=>x.descriptionId==data?.descriptionId);
   let allDescriptions="";
   let isNameAdded=false;

 if (Array.isArray(data.attributes) && data.attributes.includes("obstructed")) {
   allDescriptions += ", Obstructed View";
   isNameAdded = true;
 }

  // if(data?.accessibility.includes("sight") || data?.accessibility.includes("hearing"))
  // {
  //   allDescriptions+=", deaf/hard, blind/low";
  //   isNameAdded=true;
  // }

   const offerName = offer?.name || '';
  if (offerName.toLowerCase().includes("limited/obstructed")) {
    allDescriptions += ", Limted/Obstructed View";
    isNameAdded = true;
  } else if (offerName.toLowerCase().includes("limited view")) {
    allDescriptions += ", Limited View";
    isNameAdded = true;
  }

  if (!isNameAdded && _descriptions?.descriptions) {
    _descriptions.descriptions.forEach(x => {
      if (!x) return;
      const desc = x.toLowerCase();
      if (desc.includes("side")) {
        allDescriptions += ", Side View";
      } else if (desc.includes("behind")) {
        allDescriptions += ", Behind The Stage";
      } else if (desc.includes("rear")) {
        allDescriptions += ", Rear View Seating";
      } else if (desc.includes("partial")) {
        allDescriptions += ", Partial View";
      } else if (desc.includes("limited")) {
        allDescriptions += ", Limited View";
      } else if (desc.includes("obstructed")) {
        allDescriptions += ", obstructed View";
      } else if (desc.includes("deaf") || desc.includes("blind")) {
        allDescriptions += ", deaf/hard, blind/low";
      }
    });
  }

  // --- PRICING: Use API's totalPrice as the absolute source of truth ---
  // totalPrice from API already includes ALL fees (service, facility, order processing, tax, etc.)
  // This is what the buyer actually pays per ticket - no manual calculation needed.
  // If totalPrice is missing, fall back to manual sum for backward compatibility.
  const faceValue = offer?.faceValue || 0;
  const noChargesPrice = offer?.noChargesPrice || faceValue;
  const charges = offer?.charges || [];

  // Extract individual fee components (for analysis/storage, NOT for total calculation)
  const serviceFee = charges.filter(c => c?.reason === "service").reduce((sum, c) => sum + (c?.amount || 0), 0);
  const facilityFee = charges.filter(c => c?.reason === "facility").reduce((sum, c) => sum + (c?.amount || 0), 0);
  const orderProcessingFee = charges.filter(c => c?.reason === "order_processing").reduce((sum, c) => sum + (c?.amount || 0), 0);
  const taxAmount = charges.filter(c => c?.reason === "face_value_tax").reduce((sum, c) => sum + (c?.amount || 0), 0);

  // Per-ticket cost: use totalPrice from API (absolute source of truth)
  // Fallback: if API doesn't have totalPrice, calculate from charges manually
  let perTicketCost;
  if (offer?.totalPrice && offer.totalPrice > 0) {
    perTicketCost = offer.totalPrice;
  } else {
    // Fallback: order_processing is per-order (split across seats), other charges are per-ticket
    const orderProcessingPerSeat = orderProcessingFee / (data?.seats?.length || 1);
    const otherChargesTotal = charges.filter(c => c?.reason !== "order_processing").reduce((sum, c) => sum + (c?.amount || 0), 0);
    perTicketCost = faceValue + otherChargesTotal + orderProcessingPerSeat;
  }

  // Total fees = everything above face value (catches ALL fee types, even future unknown ones)
  const totalFees = perTicketCost - faceValue;

  const listCostPercentage = event?.listCostPercentage || 0;
  const perTicketWithMarkup = perTicketCost + (perTicketCost * (listCostPercentage / 100));

  return {
      "inventory": {
      "quantity": data?.seats?.length || 0,
      "section": data?.section || "",
      "hideSeatNumbers": true,
      "row": data?.row || "",
      "cost": perTicketCost * (data?.seats?.length || 0),
      "seats": data?.seats || [],
      "eventId": event?.eventMappingId,
        "stockType": "MOBILE_TRANSFER",
        "lineType": "PURCHASE",
        "seatType": "CONSECUTIVE",
        "inHandDate": moment(event?.inHandDate).format("YYYY-MM-DDTHH:mm:ss"),
        "notes": "-tnow -tmplus -stub",
        "tags": "AWS",
        "inventoryId": 0,
        "offerId": data?.offerId,
        "splitType":"CUSTOM",
        "publicNotes": "xfer"+allDescriptions,
        "listPrice": perTicketWithMarkup,
        "customSplit":getSplitType(data?.seats,offer),
        // Fee breakdown fields
        "face_price": faceValue,
        "totalPrice": perTicketCost,
        "noChargesPrice": noChargesPrice,
        "serviceFee": serviceFee,
        "facilityFee": facilityFee,
        "orderProcessingFee": orderProcessingFee,
        "taxAmount": taxAmount,
        "totalFees": totalFees,
        "offerName": offer?.name || "",
        "inventoryType": offer?.inventoryType || "",
         "tickets":data?.seats.map(y=>{return {
                "id": 0,
                "seatNumber":y,
                "notes": "string",
                "cost": perTicketCost,
                "faceValue": faceValue,
                "taxedCost": perTicketCost,
                "sellPrice": perTicketWithMarkup,
                "stockType": "HARD",
                "eventId": 0,
                "accountId": 0,
                "status": "AVAILABLE",
                "auditNote": "string"
         }})
    },
    "amount": 0,
    "lineItemType": "INVENTORY",
    "eventId": event?.eventMappingId,
    "dbId":`${data?.seats.join('')}-${data?.row}-${data?.section}-${event?.eventMappingId}`,
    "seats":data?.seats,
    "row":data?.row,
    "section":data?.section,
}
}
 
export const AttachRowSection = (data, mapData, offers, event,descriptions) => {
  
 let allAvailableSeats = GetMapSeats(mapData);
   if (!allAvailableSeats || allAvailableSeats.length === 0) {
    console.log("No available seats found in map data");
    return [];
  }
  let mapPlacesIndex = allAvailableSeats.map(x => x.seatId);
  let returnData=[];
  //get all seats number by seat id
  let customData=data.map(x => {

    if (x.places.length > 0) {
      let placeId = x.places[0];
      if (placeId) {

        let indexToFind = mapPlacesIndex.indexOf(placeId);

        if (indexToFind != -1) {
          let found = allAvailableSeats[indexToFind];
          // let  found= allAvailableSeats.find(y=>y.seatId==placeId);
          if (found) {
            let allPlaces = x?.places.map(z => {

              let indexOfZ = mapPlacesIndex.indexOf(z);

              let foundSeatFromMap = allAvailableSeats[indexOfZ];
              if (foundSeatFromMap && indexOfZ != -1) {
                return { ...foundSeatFromMap, offerId:x.offerId }
              }
              foundSeatFromMap = undefined;

              //SORT BY (seat) NUMBER
            }).filter(y => y != undefined);
            
            return {
              section: found.section,
              row: "",
              seats: allPlaces,
              eventId: event?.eventMappingId,
              offerId:x.offerId,
              accessibility:x?.accessibility,
              descriptionId:x?.descriptionId,
              attributes:x?.attributes
            }
          }
          found = undefined;

        }
      }

    }

    return undefined;
  }).filter(x => x != undefined);

    //it will check if pair has same row as some events are giving pair of different row
    let groupedSeats = [];
    customData.forEach(seatGroup => {
      const rows = [...new Set(seatGroup.seats.map(seat => seat.row))];
      rows.forEach(row => {
        const seatsInRow = seatGroup.seats.filter(seat => seat.row === row);
        groupedSeats.push({
          section: seatGroup.section,
          seats: seatsInRow,
          eventId: seatGroup.eventId,
          offerId: seatGroup.offerId,
          accessibility: seatGroup.accessibility,
          descriptionId: seatGroup.descriptionId,
          attributes: seatGroup.attributes
        });
      });
    });
    
     //add row and get seats in order
  groupedSeats.map(x=>{
    if(x?.seats.length>0)
    {
      return {
        ...x,
        row:x?.seats[0]?.row,
        seats:x?.seats.map(y => parseInt(y.seat)).sort((a, b)=>{return a - b})
      }
    }
    else
    {
      return undefined;
    }
      
  }).filter(x => x != undefined)
  
  //break seats if it is not consicutive ex [1,2,3,6,7] => [1,2,3],[6,7]
  .map(x=>{
    let breakOBJ=breakArray(x.seats)
 
     if(breakOBJ.length>1)
     {
         breakOBJ.map(y=>{
          returnData.push({
                 ...x,
                 seats:y
                 
             })
         })
     }
     else
     {
      returnData.push(x)
     }
 });
 
 
 //it will make consicutive seats ex [2],[4],[3] => [2,3,4]
 returnData= CreateConsicutiveSeats(returnData);
 
 //attach offer

return returnData.map(x=>{
  let offerGet = offers.find(e => e.offerId == x.offerId);
  
  if(offerGet)
  {
    if(offerGet.name=="Special Offers")
    {
       return undefined;
    }
    else if(offerGet.name=="Summer's Live 4 Pack")
    {
       return undefined;
    }
    else if(offerGet.name=="Me + 3 4-Pack Offer")
    {
       return undefined;
    }
    else if (offerGet?.protected==true)
    {
      return undefined;
    }
    else
       {
       
        return CreateInventoryAndLine(x,offerGet,event,descriptions)
       }
  }
  else
  {
  return undefined;
  }

 }).filter(x=>x!=undefined).filter((obj, index, self) => {
    // Convert dbId value to string to compare
    var dbId = obj.dbId.toString();
  
    // Check if the current dbId is the first occurrence in the array
    return index === self.findIndex((o) => o.dbId.toString() === dbId);
  }).filter(x=>x.inventory.quantity>1)
  
  //remove duplicate
  .filter((obj, index, self) => {
    // Check if any other object has the same row and section
    const hasDuplicate = self.some((otherObj, otherIndex) => {
      return (
        index !== otherIndex && // Exclude the current object from comparison
        obj.row === otherObj.row &&
        obj.section === otherObj.section &&
        obj.seats.some(seat => otherObj.seats.includes(seat))
      );
    });
  
    return !hasDuplicate || index === 0; // Keep the first object or objects without duplicates
  });

}
