-- Add counterOfferTo field to quotes table for provider counter-offer support
ALTER TABLE "quotes" ADD COLUMN "counter_offer_to" TEXT;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_counter_offer_to_fkey" FOREIGN KEY ("counter_offer_to") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
