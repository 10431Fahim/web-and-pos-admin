import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { OrderDetailsRoutingModule } from './order-details-routing.module';
import { OrderDetailsComponent } from './order-details.component';
import {MaterialModule} from "../../../material/material.module";
import {OrderTimelineModule} from "../../../shared/components/order-timeline/order-timeline.module";
import {ProductPricePipe} from "../../../shared/pipes/product-price.pipe";
import {ImageLoadErrorModule} from "../../../shared/directives/image-load/image-load-error.module";
import {CurrencyPipe} from "../../../shared/pipes/currency.pipe";
import { FraudCheckerComponent } from './fraud-checker/fraud-checker.component';
import {
    GalleryImageViewerComponent
} from "../../../shared/components/gallery-image-viewer/gallery-image-viewer.component";


@NgModule({
  declarations: [
    OrderDetailsComponent
  ],
    imports: [
        CommonModule,
        OrderDetailsRoutingModule,
        MaterialModule,
        OrderTimelineModule,
        ProductPricePipe,
        ImageLoadErrorModule,
        CurrencyPipe,
        GalleryImageViewerComponent,
        FraudCheckerComponent
    ]
})
export class OrderDetailsModule { }
