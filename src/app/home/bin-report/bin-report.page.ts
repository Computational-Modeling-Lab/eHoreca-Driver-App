import { Component, OnInit } from '@angular/core';
import { ModalController, ActionSheetController, NavParams, LoadingController, AlertController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-bin-report',
  templateUrl: './bin-report.page.html',
  styleUrls: ['./bin-report.page.scss'],
})
export class BinReportPage implements OnInit {
  maxDistance: number = 15; // the maximum number of meters the truck can be away from the bin, accuracy error correction
  distance: number; // the distance from the bin

  numberOfBins: number;
  binsCollection: Array<number>;

  // 'compost', 'glass', 'recyclable', 'mixed', 'metal', 'paper', 'plastic'
  types = ['compost', 'glass', 'recyclable', 'mixed', 'metal', 'paper', 'plastic'];
  percents: Array<number>;

  selectedType: string = 'mixed';
  binPercents: Array<number>;
  binFinalPercent: number = 0;

  coords: { lat: number, lng: number };
  bin: any;

  constructor(
    private modalctrl: ModalController,
    private actionSheetController: ActionSheetController,
    private navParams: NavParams,
    private loadingctrl: LoadingController,
    private alertctrl: AlertController,
    public translate: TranslateService,
  ) {
    this.coords = this.navParams.get('coords');
    this.bin = this.navParams.get('bin');

    this.numberOfBins = this.bin.quantity;
    this.selectedType = this.bin.type;
    this.binsCollection = Array(this.numberOfBins).fill(1).map((x, i) => i + 1);
    this.percents = Array(11).fill(1).map((x, i) => i * 10);
    this.binPercents = Array(this.numberOfBins).fill(50);
  }

  async ngOnInit() {
    const loading = await this.loadingctrl.create({ message: `${this.translate.instant('COMMON.LOADING')}...` });
    loading.present();

    // distance from bin
    const R = 6371.0710;  // Radius of Earth in Kilometers
    const rlat1 = this.coords.lat * (Math.PI / 180);  // Convert degrees to radians
    const rlat2 = this.bin.location.lat * (Math.PI / 180);  // Convert degrees to radians
    const difflat = rlat2 - rlat1;  // Radian difference (latitudes)
    const difflng = (this.coords.lng - this.bin.location.lng) * (Math.PI / 180);  // Radian difference (longitudes)

    this.distance = Math.abs((2 * R * Math.asin(Math.sqrt(Math.sin(difflat / 2) * Math.sin(difflat / 2) + Math.cos(rlat1) * Math.cos(rlat2) * Math.sin(difflng / 2) * Math.sin(difflng / 2)))) / 1000); // distance in meters

    if (this.distance > this.maxDistance) {
      this.alertctrl.create(
        {
          header: `${this.translate.instant('PAGES.BINREPORT.TOOFARAWAY')}`,
          message: `${this.translate.instant('PAGES.BINREPORT.TOOFARAWAYERROR')}`,
          buttons: [
            {
              text: `${this.translate.instant('COMMON.DISMISS')}`,
              handler: () => {
                this.dismiss();
              }
            }
          ]
        }
      ).then(alert => {
        loading.dismiss();
        alert.present();
      }
      );
    }
    else loading.dismiss();
  }

  async showActionSheet(target: string, binNumber: number = 0) {
    let opts = {
      cssClass: 'my-action-sheet',
      buttons: []
    };

    switch (target) {
      case 'type':
        this.types.forEach(type => {
          opts.buttons.push(
            {
              text: this.translate.instant(`PAGES.BINREPORT.BINTYPES.${type.toUpperCase()}`),
              handler: () => { this.selectedType = type; }
            })
        });
        break;
      case 'percent':
        this.percents.forEach(percent => {
          opts.buttons.push(
            {
              text: `${percent}%`,
              handler: () => { this.binPercents[binNumber] = percent; }
            })
        });
        break;
    }

    await this.actionSheetController.create(opts).then(async actionSheet => { await actionSheet.present() })
  }

  changedQuantity(changeType: string) {
    switch (changeType) {
      case 'plus':
        this.numberOfBins += 1;
        break;
      case 'minus':
        if (this.numberOfBins > 1) this.numberOfBins -= 1;
        break;
    }

    this.binsCollection = Array(this.numberOfBins).fill(1).map((x, i) => i + 1);
    this.binPercents = Array(this.numberOfBins).fill(0);
  }

  percentagesCalculate() {
    var totalPercents = 0;

    this.binPercents.forEach(percent => {
      totalPercents += percent;
    });

    this.binFinalPercent = totalPercents / this.numberOfBins;
  }

   confirm(): void {
    this.percentagesCalculate();
    const data = {
      bin_id: this.bin.id,
      quantity: this.bin.quantity,
      percents: this.binPercents,
      total_percent: this.binFinalPercent,
      type: this.selectedType,
      distance_when_picked: this.distance,
      time:new Date(Date.now()).toISOString(),
    };

    this.dismiss(true, data);
  }

  dismiss(confirm: boolean = false, data: any = null) {
    this.modalctrl.dismiss(
      {
        confirm,
        bin_data: data,
      }
    );
  }

}
