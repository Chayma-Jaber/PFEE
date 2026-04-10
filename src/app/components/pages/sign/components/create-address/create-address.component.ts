import { Component, EventEmitter, Input, Output, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProfileService } from '../../profile';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

interface City {
  name: string;
  delegations: Delegation[];
}

interface Delegation {
  name: string;
  localities: Locality[];
}

interface Locality {
  name: string;
  postcode?: number;
  postCode?: number;
  codepost?: number;
  postcode_?: number;
  code?: number;
  postal?: number;
  zip?: number;
  [key: string]: any; // Permet d'accéder à n'importe quelle propriété avec une notation d'index
}

@Component({
  selector: 'app-create-address',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ToastModule
  ],
  templateUrl: './create-address.component.html',
  styleUrl: './create-address.component.scss',
  providers: [MessageService]
})
export class CreateAddressComponent implements OnInit, AfterViewInit {
  @ViewChild('localitySelect') localitySelectRef!: ElementRef;

  addressForm: FormGroup;
  cities: City[] = [];
  cityNames: string[] = [];
  delegations: Delegation[] = [];
  delegationNames: string[] = [];
  localities: Locality[] = [];
  localityNames: string[] = [];

  selectedCity: string = '';
  selectedDelegation: string = '';
  isLoading: boolean = true;

  constructor(public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private profileService: ProfileService,
    private messageService: MessageService
  ) {
    this.addressForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(3)]],
      lastName: ['', [Validators.required, Validators.minLength(3)]],
      phone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-\(\)]+$/)]], // Allow +, (), -, spaces
      address: ['', [Validators.required]],
      city: ['', [Validators.required]],
      delegation: ['', [Validators.required]],
      locality: ['', [Validators.required]],
      codepost: [{value: '', disabled: true}, [Validators.required]],
      defaultAddress: [false]
    });
  }

  ngOnInit(): void {
    this.loadCities();
  }

  ngAfterViewInit(): void {
    this.setupDropdownDirection();
  }

  /**
   * Configure la direction des menus déroulants
   * Force l'affichage vers le bas pour le menu de localité
   */
  setupDropdownDirection(): void {
    // Attendre que le DOM soit complètement chargé
    setTimeout(() => {
      try {
        // Utiliser la référence au menu déroulant de localité
        if (this.localitySelectRef && this.localitySelectRef.nativeElement) {
          const localityDropdown = this.localitySelectRef.nativeElement;

          // Supprimer l'attribut size qui peut causer des problèmes avec l'ouverture du dropdown
          localityDropdown.removeAttribute('size');

          // S'assurer que le style est correct pour un dropdown
          localityDropdown.style.overflow = 'visible';
          localityDropdown.style.height = 'auto';

          // Ajouter une classe pour s'assurer que le dropdown s'ouvre correctement
          localityDropdown.classList.add('dropdown-enabled');

       
        } else {
          // Fallback à la méthode querySelector si la référence n'est pas disponible
          const localityDropdown = document.querySelector('select[formControlName="locality"]');

          if (localityDropdown) {
            // Supprimer l'attribut size qui peut causer des problèmes avec l'ouverture du dropdown
            localityDropdown.removeAttribute('size');

            // S'assurer que le style est correct pour un dropdown
            (localityDropdown as HTMLElement).style.overflow = 'visible';
            (localityDropdown as HTMLElement).style.height = 'auto';

            // Ajouter une classe pour s'assurer que le dropdown s'ouvre correctement
            localityDropdown.classList.add('dropdown-enabled');

         
          } else {
            // console.log('Locality dropdown not found in DOM');
          }
        }
      } catch (error) {
        console.error('Error setting up dropdown direction:', error);
      }
    }, 100); // Réduire le délai pour une meilleure réactivité
  }

  loadCities(): void {
    this.isLoading = true;
    this.profileService.getCities().subscribe({
      next: (response) => {
        if (response && response.hits) {
          // console.log('API Response:', response.hits);

          // Analyser la structure de la première ville pour le débogage
          if (response.hits.length > 0) {
            const firstCity = response.hits[0];
         

            // Analyser la structure de la première délégation
            if (firstCity.delegations && firstCity.delegations.length > 0) {
              const firstDelegation = firstCity.delegations[0];
         

              // Analyser la structure de la première localité
              if (firstDelegation.localities && firstDelegation.localities.length > 0) {
                const firstLocality = firstDelegation.localities[0];
            

                // Vérifier spécifiquement la propriété du code postal
                Object.keys(firstLocality).forEach(key => {
                  if (key.toLowerCase().includes('post') || key.toLowerCase().includes('code')) {
                    
                  }
                });
              }
            }
          }

          this.cities = response.hits;
          this.cityNames = this.cities.map(city => city.name);
        } else {
          console.error('Invalid API response format:', response);
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Format de réponse API invalide',
            life: 3000
          });
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading cities:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible de charger les villes',
          life: 3000
        });
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  /**
   * Méthode appelée lorsqu'une ville est sélectionnée
   * Met à jour la liste des délégations en fonction de la ville sélectionnée
   */
  onCityChange(event: any): void {
    const cityName = event.target.value;
    this.selectedCity = cityName;

    // Réinitialiser les champs de délégation et localité
    this.addressForm.get('delegation')?.setValue('');
    this.addressForm.get('locality')?.setValue('');
    this.addressForm.get('codepost')?.setValue('');

    // Trouver la ville sélectionnée dans la liste des villes
    const selectedCity = this.cities.find(city => city.name === cityName);

    // Mettre à jour la liste des délégations
    if (selectedCity) {
      this.delegations = selectedCity.delegations;
      this.delegationNames = this.delegations.map(delegation => delegation.name);
    } else {
      this.delegations = [];
      this.delegationNames = [];
    }
  }

  /**
   * Méthode appelée lorsqu'une délégation est sélectionnée
   * Met à jour la liste des localités en fonction de la délégation sélectionnée
   */
  onDelegationChange(event: any): void {
    const delegationName = event.target.value;
    this.selectedDelegation = delegationName;
   

    // Réinitialiser le champ de localité
    this.addressForm.get('locality')?.setValue('');
    this.addressForm.get('codepost')?.setValue('');

    // Trouver la délégation sélectionnée dans la liste des délégations
    const selectedDelegation = this.delegations.find(delegation => delegation.name === delegationName);
   

    // Mettre à jour la liste des localités
    if (selectedDelegation && selectedDelegation.localities) {
      this.localities = selectedDelegation.localities;
   

      // Examiner la structure de chaque localité pour le débogage
      if (this.localities.length > 0) {
       
        const firstLocality = this.localities[0];

        // Afficher toutes les propriétés de la première localité
        Object.keys(firstLocality).forEach(key => {
  

          // Si c'est un objet imbriqué, l'examiner également
          if (typeof firstLocality[key] === 'object' && firstLocality[key] !== null) {
          
          }
        });
      }

      this.localityNames = this.localities.map(locality => locality.name);
 
    } else {
   
      this.localities = [];
      this.localityNames = [];
    }
  }

  /**
   * Méthode appelée lorsqu'une localité est sélectionnée
   * Met à jour le code postal en fonction de la localité sélectionnée
   */
  onLocalityChange(event: any): void {
    const localityName = event.target.value;
 

    // Trouver la localité sélectionnée dans la liste des localités
    const selectedLocality = this.localities.find(locality => locality.name === localityName);
   

    // Mettre à jour le code postal
    if (selectedLocality) {

      Object.keys(selectedLocality).forEach(key => {
      
      });

      // Vérifier si la propriété est 'postcode' ou 'postCode' ou autre
      let postalCode = '';

      try {
        // Essayer d'accéder à la propriété 'postcode' directement
        if (selectedLocality.hasOwnProperty('postcode')) {
          postalCode = String(selectedLocality.postcode);
        
        }
        // Essayer d'accéder à la propriété 'postCode' directement
        else if (selectedLocality.hasOwnProperty('postCode')) {
          postalCode = String(selectedLocality.postCode);
          
        }
        // Essayer d'accéder à la propriété 'codepost' directement
        else if (selectedLocality.hasOwnProperty('codepost')) {
          postalCode = String(selectedLocality.codepost);
       
        }
        // Essayer d'accéder à la propriété 'postcode_' directement
        else if (selectedLocality.hasOwnProperty('postcode_')) {
          postalCode = String(selectedLocality.postcode_);

        }
        // Essayer d'accéder à la propriété 'code' directement
        else if (selectedLocality.hasOwnProperty('code')) {
          postalCode = String(selectedLocality.code);
     
        }
        // Essayer d'accéder à la propriété 'postal' directement
        else if (selectedLocality.hasOwnProperty('postal')) {
          postalCode = String(selectedLocality.postal);
         
        }
        // Essayer d'accéder à la propriété 'zip' directement
        else if (selectedLocality.hasOwnProperty('zip')) {
          postalCode = String(selectedLocality.zip);
        
        }
        // Si aucune des propriétés connues n'est trouvée, parcourir toutes les propriétés
        else {
          // Parcourir toutes les propriétés de l'objet pour trouver le code postal
          for (const key in selectedLocality) {
            if (selectedLocality.hasOwnProperty(key)) {
              if (key.toLowerCase().includes('post') || key.toLowerCase().includes('code') || key.toLowerCase().includes('zip')) {
                if (selectedLocality[key] !== undefined && selectedLocality[key] !== null) {
                  postalCode = String(selectedLocality[key]);
           
                  break;
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error while trying to find postal code:', error);
      }



      if (postalCode) {
        try {
          // Activer temporairement le contrôle pour le mettre à jour
          const codepostControl = this.addressForm.get('codepost');
          if (codepostControl) {
            // Activer le contrôle
            codepostControl.enable();

            // Définir la valeur
            codepostControl.setValue(postalCode);
      

            // Désactiver le contrôle
            codepostControl.disable();

            // Forcer la mise à jour du formulaire
            this.addressForm.updateValueAndValidity();

            // Vérifier la valeur
      

            // Vérifier après un court délai
            setTimeout(() => {


              // Si toujours pas de valeur, essayer une autre approche
              if (!codepostControl.value && postalCode) {
     

                // Essayer de mettre à jour directement le modèle
                const rawValue = this.addressForm.getRawValue();
                rawValue.codepost = postalCode;

                // Mettre à jour le formulaire avec les nouvelles valeurs
                this.addressForm.patchValue({
                  codepost: postalCode
                });

                // Forcer la mise à jour du formulaire
                this.addressForm.updateValueAndValidity();

                
              }
            }, 100);
          } else {
            console.error('Could not find codepost control in form');
          }
        } catch (error) {
          console.error('Error while setting postal code:', error);
        }
      } else {
     
        this.addressForm.get('codepost')?.setValue('');
      }
    } else {
      this.addressForm.get('codepost')?.setValue('');
    
    }
  }

  closeModal() {
    this.activeModal.dismiss('Address not created');
  }

  createAddress() {
    // Check if all required fields are filled
    const requiredFieldsFilled =
      this.addressForm.get('firstName')?.valid &&
      this.addressForm.get('lastName')?.valid &&
      this.addressForm.get('phone')?.valid &&
      this.addressForm.get('address')?.valid &&
      this.addressForm.get('city')?.valid &&
      this.addressForm.get('delegation')?.valid &&
      this.addressForm.get('locality')?.valid;

    // Check if postal code is available
    const postalCodeAvailable = this.addressForm.get('codepost')?.value !== '';

    if (requiredFieldsFilled && postalCodeAvailable) {
      // Get all form values including disabled controls
      const formValues = this.addressForm.getRawValue();

      // Create the address data object
      const addressData = {
        firstName: formValues.firstName,
        lastName: formValues.lastName,
        phone: formValues.phone,
        address: formValues.address,
        city: formValues.city,
        delegation: formValues.delegation,
        locality: formValues.locality,
        codepost: formValues.codepost,
        defaultAddress: formValues.defaultAddress
      };

      this.profileService.createAddress(addressData).subscribe({
        next: (response) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Adresse créée',
            detail: 'L\'adresse a été créée avec succès',
            life: 3000
          });
          this.activeModal.close(response['data']); // Close the modal after success
        },
        error: (error) => {
          if (error.error?.name === 'ValidationError' && error.error?.message.includes('First name must be at least 3 characters long')) {
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur de validation',
              detail: 'Le prénom et le nom doivent comporter au moins 3 caractères',
              life: 3000
            });
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: 'Une erreur est survenue lors de la création de l\'adresse',
              life: 3000
            });
          }
          console.error('Error creating address:', error);
        }
      });
    } else {
      this.addressForm.markAllAsTouched(); // Mark all fields as touched to show validation errors

      // Check for specific validation errors
      const firstNameErrors = this.addressForm.get('firstName')?.errors;
      const lastNameErrors = this.addressForm.get('lastName')?.errors;

      if (firstNameErrors?.['minlength'] || lastNameErrors?.['minlength']) {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur de validation',
          detail: 'Le prénom et le nom doivent comporter au moins 3 caractères',
          life: 3000
        });
      } else if (!postalCodeAvailable) {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Veuillez sélectionner une localité pour obtenir un code postal',
          life: 3000
        });
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Veuillez corriger les erreurs dans le formulaire',
          life: 3000
        });
      }
    }
  }

  isFormValid(): boolean {
    if (!this.addressForm) return false;
    
    const formValue = this.addressForm.getRawValue();
    const requiredFields = ['firstName', 'lastName', 'phone', 'address', 'city', 'delegation', 'locality', 'codepost'];
    
    return requiredFields.every(field => {
      const value = formValue[field];
      return value !== null && value !== undefined && value !== '';
    });
  }
}
