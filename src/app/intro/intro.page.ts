import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Storage } from '@capacitor/storage';
import { TranslateService } from '@ngx-translate/core';
import { ConstantsService } from '../services/constants/constants.service'

@Component({
  selector: 'app-intro',
  templateUrl: './intro.page.html',
  styleUrls: ['./intro.page.scss'],
})
export class IntroPage implements OnInit {
  constructor(
    private translate: TranslateService,
    private router: Router,
    public constants: ConstantsService,
  ) { }

  async setLanguage (language: string): Promise<void> {
    this.translate.use(language);
    await Storage.set({ key: "language", value: language });
    this.router.navigate(['/login']);
  }

  ngOnInit() {
  }

}
