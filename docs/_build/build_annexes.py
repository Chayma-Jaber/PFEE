# -*- coding: utf-8 -*-
"""
Generate docs/Annexes_UML_Barsha.docx — companion to the main PFE report.
Contains the full PlantUML source code for every UML diagram, plus the
rendered PNG below each source so the reader has both representations.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from build_helpers import (
    Document, set_default_styles, set_a4_margins,
    heading, para, justified, bullet,
    code_block, page_break, image, table, add_toc, page_numbers,
    Cm, Pt, RGBColor, WD_ALIGN_PARAGRAPH,
)

PUML_DIR = os.path.join(os.path.dirname(__file__), "puml")
PNG_DIR = os.path.join(os.path.dirname(__file__), "png")


def cover(doc):
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("ANNEXE A"); r.font.size = Pt(13); r.bold = True
    r.font.color.rgb = RGBColor(0x1F, 0x3A, 0x5F)

    for _ in range(4):
        doc.add_paragraph()

    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Codes sources PlantUML"); r.font.size = Pt(28); r.bold = True
    r.font.color.rgb = RGBColor(0x1F, 0x3A, 0x5F)

    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("des diagrammes UML du mémoire de soutenance"); r.font.size = Pt(14); r.italic = True

    for _ in range(3):
        doc.add_paragraph()

    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Plateforme Barsha — projet de fin d'études"); r.font.size = Pt(13); r.italic = True

    for _ in range(8):
        doc.add_paragraph()

    justified(doc,
        "Cette annexe contient l'intégralité du code source PlantUML utilisé pour produire "
        "les douze diagrammes UML reproduits dans le mémoire principal "
        "(Rapport_PFE_Barsha_Soutenance.docx). Pour chaque diagramme :")
    bullet(doc, "Le code source PlantUML est reproduit en intégralité dans un bloc de code monospace.")
    bullet(doc, "L'image rendue (PNG) est insérée à la suite, à des fins de relecture conjointe.")
    bullet(doc, "Le code peut être régénéré via la commande : "
                "java -jar plantuml.jar -tpng <fichier>.puml")

    justified(doc,
        "Tous les fichiers .puml sont également versionnés dans le dépôt source du projet, "
        "sous docs/_build/puml/. Toute modification ultérieure des diagrammes doit se faire "
        "en éditant ces fichiers et en relançant le rendu, afin de préserver la traçabilité.")

    page_break(doc)


def diagram_section(doc, num, title, puml_filename, png_filename, fig_num, caption):
    """Render one section: heading + description + PlantUML source + PNG."""
    heading(doc, f"A.{num} {title}", level=1)
    puml_path = os.path.join(PUML_DIR, puml_filename)
    if not os.path.exists(puml_path):
        para(doc, f"[fichier introuvable: {puml_filename}]", italic=True)
        page_break(doc)
        return
    with open(puml_path, encoding="utf-8") as f:
        src = f.read()

    para(doc, f"Fichier source : docs/_build/puml/{puml_filename}", italic=True)
    para(doc, "Code PlantUML :", bold=True)
    code_block(doc, src)
    para(doc, "Rendu :", bold=True)
    image(doc, png_filename, width_cm=15.5,
          caption=caption, fig_num=fig_num)
    page_break(doc)


def build():
    doc = Document()
    set_default_styles(doc)
    set_a4_margins(doc)
    page_numbers(doc.sections[0])

    cover(doc)
    add_toc(doc)

    diagrams = [
        (1, "Diagramme de cas d'utilisation",          "01_use_cases.puml",          "use_cases.png",          1, "Diagramme de cas d'utilisation de la plateforme Barsha"),
        (2, "Architecture logicielle globale",         "02_architecture.puml",       "architecture.png",       2, "Architecture logicielle globale"),
        (3, "Diagramme de déploiement",                "03_deployment.puml",         "deployment.png",         3, "Diagramme de déploiement (staging single-host)"),
        (4, "Diagramme de classes",                    "04_class_diagram.puml",      "class_diagram.png",      4, "Diagramme de classes (extrait — domaine commerce, marketplace et IA)"),
        (5, "Modèle conceptuel de données (ER)",       "05_er_model.puml",           "er_model.png",           5, "Modèle conceptuel de données (extrait — schéma relationnel MSSQL)"),
        (6, "Séquence — authentification",             "06_seq_auth.puml",           "seq_auth.png",           6, "Diagramme de séquence — authentification (login + JWT refresh)"),
        (7, "Séquence — passage de commande",          "07_seq_order.puml",          "seq_order.png",          7, "Diagramme de séquence — passage de commande"),
        (8, "Séquence — recommandations IA",           "08_seq_recommendation.puml", "seq_reco.png",           8, "Diagramme de séquence — recommandations IA personnalisées"),
        (9, "Séquence — recherche visuelle",           "09_seq_visual_search.puml",  "seq_visual.png",         9, "Diagramme de séquence — recherche visuelle"),
        (10, "Séquence — expédition et suivi",         "10_seq_shipping.puml",       "seq_shipping.png",       10, "Diagramme de séquence — expédition et suivi de livraison"),
        (11, "Séquence — gestion administrateur",      "11_seq_admin.puml",          "seq_admin.png",          11, "Diagramme de séquence — gestion admin (création produit + indexation)"),
        (12, "Activité — tunnel d'achat",              "12_activity_checkout.puml",  "activity_checkout.png",  12, "Diagramme d'activité — tunnel d'achat Barsha"),
    ]

    for num, title, puml, png, fig_num, caption in diagrams:
        diagram_section(doc, num, title, puml, png, fig_num, caption)

    out_path = os.path.normpath(os.path.join(
        os.path.dirname(__file__), "..", "Annexes_UML_Barsha.docx"))
    doc.save(out_path)
    print(f"OK : {out_path}")
    return out_path


if __name__ == "__main__":
    build()
